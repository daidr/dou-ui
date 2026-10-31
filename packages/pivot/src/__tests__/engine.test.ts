import { describe, expect, it } from 'vitest'
import { IntIndex } from '../engine/hash'
import {
  bucketer,
  computePivot,
  defineAggregator,
  isoWeek,
  PivotSource,
  type PivotConfig,
} from '../engine'

interface Order {
  region: string | null
  city: string
  month: number
  amount: number | null
  channel: string
}

/** Records with repeats, empties and a fixed seed, so every case is the same each run. */
function makeOrders(count: number, seed = 7): Order[] {
  let state = seed
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const regions = ['华东', '华南', '华北', '西南', null]
  const channels = ['线上', '门店', '分销']
  return Array.from({ length: count }, () => {
    const r = Math.floor(random() * regions.length)
    return {
      region: regions[r]!,
      city: `城市${r}-${Math.floor(random() * 4)}`,
      month: 1 + Math.floor(random() * 12),
      amount: random() < 0.05 ? null : Math.round(random() * 1000) / 10,
      channel: channels[Math.floor(random() * channels.length)]!,
    }
  })
}

const norm = (v: unknown) => (v === '' || v === undefined ? null : v)
const expectSame = (got: number, want: number) =>
  expect(Number.isNaN(want) ? Number.isNaN(got) : Math.abs(got - want) < 1e-6).toBe(true)

/** What every cell should be, worked out record by record. */
function naive(
  rows: Order[],
  rowFields: (keyof Order)[],
  colFields: (keyof Order)[],
  rowPath: unknown[],
  colPath: unknown[],
  pick: (rows: Order[]) => number,
  keep: (row: Order) => boolean = () => true,
) {
  const inCell = rows.filter(
    (row) =>
      keep(row) &&
      rowPath.every((v, d) => norm(row[rowFields[d]!]) === v) &&
      colPath.every((v, d) => norm(row[colFields[d]!]) === v),
  )
  return inCell.length === 0 ? Number.NaN : pick(inCell)
}

const amounts = (rows: Order[]) => rows.map((r) => r.amount).filter((v): v is number => v !== null)
const sum = (rows: Order[]) => {
  const list = amounts(rows)
  return list.length ? list.reduce((a, b) => a + b, 0) : Number.NaN
}

const keep = (row: Order) => row.channel !== '分销' && ['华东', '华南', null].includes(row.region)

describe('IntIndex', () => {
  it('keeps the order keys were first seen in, across growth and keys past 32 bits', () => {
    const index = new IntIndex(2)
    const keys = [0, 5, 2 ** 40 + 3, 2 ** 52, 17, 5, 2 ** 40 + 3]
    const ids = keys.map((k) => index.add(k))
    expect(ids).toEqual([0, 1, 2, 3, 4, 1, 2])
    for (let i = 0; i < 5000; i++) index.add(1e9 + i * 7919)
    expect(index.get(2 ** 52)).toBe(3)
    expect(index.get(1e9 + 4999 * 7919)).toBe(5004)
    expect(index.get(123)).toBe(-1)
    expect(index.size).toBe(5005)
  })
})

describe('computePivot', () => {
  const orders = makeOrders(3000)
  const source = new PivotSource(orders, { locale: 'zh-CN' })
  const config: PivotConfig = {
    rows: ['region', 'city'],
    columns: ['month'],
    values: [
      { field: 'amount', aggregate: 'sum' },
      { aggregate: 'count' },
      { field: 'amount', aggregate: 'avg' },
      { field: 'amount', aggregate: 'min' },
      { field: 'amount', aggregate: 'max' },
      { field: 'channel', aggregate: 'distinct' },
      { field: 'amount', aggregate: 'median' },
      { field: 'amount', aggregate: 'count' },
    ],
  }
  const result = computePivot(source, config)

  it('groups both axes, with the empty group last', () => {
    const regions = Array.from(
      result.rows.children.subarray(result.rows.childStart[0], result.rows.childStart[1]),
      (node) => result.rows.label(node),
    )
    expect(regions).toEqual(['华北', '华东', '华南', '西南', null])
    expect(result.columns.size).toBe(13)
    expect(result.matched).toBe(orders.length)
  })

  it('matches a record-by-record count for every cell, subtotal and total', () => {
    expect.hasAssertions()
    const picks: ((rows: Order[]) => number)[] = [
      sum,
      (rows) => rows.length,
      (rows) => {
        const list = amounts(rows)
        return list.length ? list.reduce((a, b) => a + b, 0) / list.length : Number.NaN
      },
      (rows) => (amounts(rows).length ? Math.min(...amounts(rows)) : Number.NaN),
      (rows) => (amounts(rows).length ? Math.max(...amounts(rows)) : Number.NaN),
      (rows) => new Set(rows.map((r) => r.channel)).size,
      (rows) => {
        const list = Float64Array.from(amounts(rows))
        // oxlint-disable-next-line unicorn/no-array-sort -- sorts its own copy
        list.sort()
        if (!list.length) return Number.NaN
        const mid = list.length >> 1
        return list.length % 2 ? list[mid]! : (list[mid - 1]! + list[mid]!) / 2
      },
      (rows) => amounts(rows).length,
    ]
    for (let r = 0; r < result.rows.size; r++) {
      for (let c = 0; c < result.columns.size; c++) {
        const rowPath = result.rows.path(r)
        const colPath = result.columns.path(c)
        picks.forEach((pick, v) => {
          const want = naive(orders, ['region', 'city'], ['month'], rowPath, colPath, pick)
          const got = result.get(r, c, v)
          expectSame(got, want)
        })
      }
    }
  })

  it('finds groups by path and lists their records', () => {
    const node = result.rows.find(['华东', '城市0-2'])
    expect(node).toBeGreaterThan(0)
    expect(result.rows.path(node)).toEqual(['华东', '城市0-2'])
    const march = result.columns.find([3])
    const records = result.indices(node, march)
    expect(records.length).toBe(result.get(node, march, 1))
    for (const i of records) expect(orders[i]!.city).toBe('城市0-2')
    expect(result.rows.find(['华东', '没有'])).toBe(-1)
  })

  it('filters with include and exclude', () => {
    const filtered = computePivot(source, {
      rows: ['region'],
      values: ['amount'],
      filters: { channel: { exclude: ['分销'] }, region: { include: ['华东', '华南', null] } },
    })
    expect(filtered.matched).toBe(orders.filter(keep).length)
    expect(filtered.get(0, 0)).toBeCloseTo(sum(orders.filter(keep)), 6)
    expect(filtered.rows.size).toBe(4)
  })

  it('counts the records when there are no values', () => {
    const counted = computePivot(source, { rows: ['region'] })
    expect(counted.values[0]!.implicit).toBe(true)
    expect(counted.get(0, 0)).toBe(orders.length)
  })

  it('sorts by label, by a custom order, and by a column without summing again', () => {
    const custom = new PivotSource(orders, {
      locale: 'zh-CN',
      fields: [
        { name: 'region', order: ['西南', '华南'] },
        { name: 'amount', type: 'number' },
      ],
    })
    const ordered = computePivot(custom, { rows: [{ field: 'region', sort: 'desc' }] })
    const labels = (r = ordered, order = r.rows.children) =>
      Array.from(order.subarray(r.rows.childStart[0], r.rows.childStart[1]), (n) => r.rows.label(n))
    // desc reverses the whole order, the empty group stays last
    expect(labels()).toEqual(['华东', '华北', '华南', '西南', null])
    const asc = computePivot(custom, { rows: ['region'] })
    expect(labels(asc)).toEqual(['西南', '华南', '华北', '华东', null])

    const byValue = result.rowOrder({ valueIndex: 0, order: 'desc', column: [] })
    const top = Array.from(byValue.subarray(result.rows.childStart[0], result.rows.childStart[1]))
    const totals = top.map((node) => result.get(node, 0, 0))
    expect(totals.every((t, i) => i === 0 || totals[i - 1]! >= t)).toBe(true)
  })

  it('takes aggregators of its own, which merge into subtotals', () => {
    const range = defineAggregator({
      name: 'range',
      init: () => ({ min: Infinity, max: -Infinity }),
      add: (s, v) => ({ min: Math.min(s.min, v), max: Math.max(s.max, v) }),
      merge: (a, b) => ({ min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) }),
      result: (s) => s.max - s.min,
    })
    const ranged = computePivot(
      source,
      { rows: ['region'], values: [{ field: 'amount', aggregate: 'range' }] },
      { aggregators: { range } },
    )
    const list = amounts(orders)
    expect(ranged.get(0, 0)).toBeCloseTo(Math.max(...list) - Math.min(...list), 6)
    expect(() =>
      computePivot(source, { values: [{ field: 'amount', aggregate: 'nope' }] }),
    ).toThrow('没有名为')
  })

  it('gives the same totals however many combinations the groups make', () => {
    // 3000 groups by 2000: past the plain array, numbered in a hash
    const wide = Array.from({ length: 4000 }, (_, i) => ({
      a: i % 3000,
      b: (i * 7) % 2000,
      c: i,
      d: i,
      e: i,
      v: i % 10,
    }))
    const wideSource = new PivotSource(wide)
    const hashed = computePivot(wideSource, { rows: ['a'], columns: ['b'], values: ['v'] })
    // five fields of 4000 groups: too many to number, walked down field by field
    const walked = computePivot(wideSource, {
      rows: ['a', 'c', 'd'],
      columns: ['b', 'e'],
      values: ['v'],
    })
    const total = wide.reduce((acc, row) => acc + row.v, 0)
    for (const out of [hashed, walked]) {
      expect(out.get(0, 0)).toBe(total)
      const a7 = out.rows.find([7])
      expect(out.get(a7, 0)).toBe(wide.filter((r) => r.a === 7).reduce((x, r) => x + r.v, 0))
      expect(out.indices(a7, out.columns.total)).toEqual([7, 3007])
    }
    expect(walked.rows.size).toBe(1 + 3000 + 4000 + 4000)
  })

  it('reads worked-out fields and dates', () => {
    const days = [new Date(2026, 0, 2), new Date(2026, 0, 1), new Date(2026, 0, 2)]
    const dated = new PivotSource(
      days.map((day, i) => ({ day, price: 10 * (i + 1), qty: i + 1 })),
      {
        fields: [{ name: 'day' }, { name: 'total', value: (row) => row.price * row.qty }],
      },
    )
    expect(dated.field('day').type).toBe('date')
    expect(dated.field('total').type).toBe('number')
    const out = computePivot(dated, { rows: ['day'], values: ['total'] })
    expect(out.rows.size).toBe(3)
    const first = out.rows.children[0]!
    expect((out.rows.label(first) as Date).getDate()).toBe(1)
    expect(out.get(first, 0)).toBe(40)
    expect(out.get(0, 0)).toBe(10 + 40 + 90)
  })

  it('groups dates by a period and numbers in ranges, from the field’s groups', () => {
    const sales = [
      { day: new Date(2025, 11, 31), amount: 5 },
      { day: '2026-01-01', amount: 10 },
      { day: new Date(2026, 1, 15), amount: 20 },
      { day: new Date(2026, 3, 1), amount: 40 },
      { day: null, amount: 80 },
    ]
    const salesSource = new PivotSource(sales, { locale: 'zh-CN' })
    const quarters = computePivot(salesSource, {
      rows: [{ field: 'day', by: 'quarter' }],
      values: ['amount'],
    })
    const labels = (out: typeof quarters) =>
      Array.from(out.rows.children, (node) => out.rows.label(node))
    expect(labels(quarters)).toEqual(['2025-Q4', '2026-Q1', '2026-Q2', null])
    expect(quarters.get(quarters.rows.find(['2026-Q1']), 0)).toBe(30)

    const years = computePivot(salesSource, {
      columns: [{ field: 'day', by: 'year' }],
      values: ['amount'],
    })
    expect(Array.from(years.columns.children, (n) => years.columns.label(n))).toEqual([
      2025,
      2026,
      null,
    ])
    // a filter on the groups of a grouping
    const filtered = computePivot(salesSource, {
      rows: ['day'],
      values: ['amount'],
      filters: { day: { include: [2026], by: 'year' } },
    })
    expect(filtered.get(0, 0)).toBe(70)

    const ranges = computePivot(salesSource, {
      rows: [{ field: 'amount', by: { step: 25 } }],
      values: [{ aggregate: 'count' }],
    })
    expect(labels(ranges)).toEqual([0, 25, 75])
    expect(ranges.get(ranges.rows.find([0]), 0)).toBe(3)
  })

  it('puts days in ISO weeks and steps without rounding noise', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toEqual([2026, 1])
    expect(isoWeek(new Date(2027, 0, 1))).toEqual([2026, 53])
    expect(isoWeek(new Date(2024, 11, 30))).toEqual([2025, 1])
    expect(bucketer('week')('2026-03-15')).toBe('2026-W11')
    expect(bucketer('month')(new Date(2026, 8, 3))).toBe('2026-09')
    expect(bucketer('day')('2026-03-05')).toBe('2026-03-05')
    expect(bucketer({ step: 0.1 })(0.35)).toBe(0.3)
    expect(bucketer({ step: 10, start: 5 })(3)).toBe(-5)
    expect(bucketer('year')('not a date')).toBeNull()
  })
})
