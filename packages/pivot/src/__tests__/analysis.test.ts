import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  computePivot,
  parseFormula,
  PivotFormulaError,
  PivotResult,
  PivotSource,
  type PivotConfig,
} from '../engine'
import { withTop, withValue } from '../fields/model'
import { DouPivot, DouPivotFields } from '../index'

const rows = [
  { region: '华东', quarter: 'Q1', amount: 100, cost: 60, cups: 10 },
  { region: '华东', quarter: 'Q2', amount: 150, cost: 80, cups: 12 },
  { region: '华东', quarter: 'Q2', amount: 50, cost: 20, cups: 4 },
  { region: '华南', quarter: 'Q1', amount: 80, cost: 50, cups: 8 },
  { region: '华南', quarter: 'Q3', amount: 40, cost: 30, cups: 5 },
  { region: '华北', quarter: 'Q2', amount: 30, cost: 10, cups: 3 },
]
const source = () =>
  new PivotSource(rows, {
    fields: [
      { name: 'region', label: '大区' },
      { name: 'quarter', label: '季度' },
      { name: 'amount', label: '销售额', type: 'number' },
      { name: 'cost', label: '成本', type: 'number' },
      { name: 'cups', label: '杯数', type: 'number' },
    ],
  })

const at = (r: PivotResult, row: unknown[], column: unknown[] = [], v = 0) =>
  r.shown(r.rows.find(row), r.columns.find(column), v)

describe('parseFormula', () => {
  it('reads numbers, names, functions and operators in their order', () => {
    const f = parseFormula('(amount - cost) / amount * 100 + -1')
    expect(f.terms).toEqual([
      { aggregate: 'sum', field: 'amount' },
      { aggregate: 'sum', field: 'cost' },
    ])
    expect(f.evaluate([200, 50])).toBe(74)
  })

  it('reads functions, brackets and Chinese names', () => {
    const f = parseFormula('sum(销售额) / count() + avg([unit price])')
    expect(f.terms).toEqual([
      { aggregate: 'sum', field: '销售额' },
      { aggregate: 'count', field: null },
      { aggregate: 'avg', field: 'unit price' },
    ])
  })

  it('leaves a division by zero empty', () => {
    expect(parseFormula('a / b').evaluate([1, 0])).toBeNaN()
  })

  it.each([
    ['', 'empty'],
    ['a +', 'incomplete'],
    ['a # b', 'unknownChar'],
    ['(a', 'expected'],
    ['a b', 'unexpected'],
    ['[a', 'unclosedBracket'],
    ['foo(a)', 'unknownFunction'],
    ['sum()', 'needsField'],
  ])('says why %j cannot be read', (text, code) => {
    let error: unknown
    try {
      parseFormula(text)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(PivotFormulaError)
    expect((error as PivotFormulaError).code).toBe(code)
  })
})

describe('calculated values', () => {
  it('works out totals as ratios of totals', () => {
    const r = computePivot(source(), {
      rows: ['region'],
      values: [{ formula: '(amount - cost) / amount' }],
    })
    expect(at(r, ['华东'])).toBeCloseTo((300 - 160) / 300)
    expect(at(r, [])).toBeCloseTo((450 - 250) / 450)
    expect(r.values[0]!.formula).toBe('(amount - cost) / amount')
  })

  it('finds fields by label and counts records', () => {
    const r = computePivot(source(), {
      rows: ['region'],
      values: [{ formula: '销售额 / count()' }],
    })
    expect(at(r, ['华东'])).toBe(100)
  })

  it('says which field is not there or not a number', () => {
    expect(() => computePivot(source(), { values: [{ formula: 'price * 2' }] })).toThrow(
      /没有名为“price”的字段/,
    )
    expect(() => computePivot(source(), { values: [{ formula: 'sum(region)' }] })).toThrow(
      /不是数字字段/,
    )
  })
})

const config = (values: PivotConfig['values']): PivotConfig => ({
  rows: ['region'],
  columns: ['quarter'],
  values,
})

describe('show', () => {
  it('shows shares of the total, the row and the column', () => {
    const total = computePivot(source(), config([{ field: 'amount', show: 'percentOfTotal' }]))
    expect(at(total, ['华东'], ['Q1'])).toBeCloseTo(100 / 450)
    expect(at(total, [], [])).toBe(1)
    const row = computePivot(source(), config([{ field: 'amount', show: 'percentOfRow' }]))
    expect(at(row, ['华东'], ['Q2'])).toBeCloseTo(200 / 300)
    const column = computePivot(source(), config([{ field: 'amount', show: 'percentOfColumn' }]))
    expect(at(column, ['华南'], ['Q1'])).toBeCloseTo(80 / 180)
  })

  it('shows shares of the parent group', () => {
    const r = computePivot(source(), {
      rows: ['region', 'quarter'],
      values: [{ field: 'amount', show: 'percentOfParent' }],
    })
    expect(at(r, ['华东', 'Q2'])).toBeCloseTo(200 / 300)
    expect(at(r, ['华东'])).toBeCloseTo(300 / 450)
  })

  it('shows differences from the group before, along the columns by default', () => {
    const r = computePivot(source(), config([{ field: 'amount', show: 'difference' }]))
    expect(r.show(0)).toEqual({ as: 'difference', along: 'columns' })
    expect(at(r, ['华东'], ['Q1'])).toBeNaN()
    expect(at(r, ['华东'], ['Q2'])).toBe(100)
    expect(at(r, [], ['Q2'])).toBe(230 - 180)
    const pct = computePivot(source(), config([{ field: 'amount', show: 'percentDifference' }]))
    expect(at(pct, ['华东'], ['Q2'])).toBe(1)
  })

  it('works along the rows when there are no column fields', () => {
    const r = computePivot(source(), {
      rows: ['region'],
      values: [{ field: 'amount', show: 'difference' }],
    })
    expect(r.show(0)!.along).toBe('rows')
    // 华东, 华北, 华南 in label order
    const order = [...r.rows.children].map((n) => r.rows.label(n))
    const second = r.rows.find([order[1]])
    expect(r.shown(second, 0)).toBe(r.get(second, 0) - r.get(r.rows.find([order[0]]), 0))
  })

  it('adds up running totals, skipping empty groups', () => {
    const r = computePivot(source(), config([{ field: 'amount', show: 'runningTotal' }]))
    expect(at(r, ['华南'], ['Q1'])).toBe(80)
    expect(at(r, ['华南'], ['Q2'])).toBe(80)
    expect(at(r, ['华南'], ['Q3'])).toBe(120)
    expect(at(r, ['华南'], [])).toBe(120)
    expect(at(r, ['华北'], ['Q1'])).toBeNaN()
  })

  it('ranks groups among those beside them', () => {
    const r = computePivot(source(), config([{ field: 'amount', show: 'rank' }]))
    expect(at(r, ['华东'], [])).toBe(1)
    expect(at(r, ['华南'], [])).toBe(2)
    expect(at(r, ['华北'], [])).toBe(3)
    expect(at(r, ['华北'], ['Q2'])).toBe(2)
    expect(at(r, [], [])).toBeNaN()
  })

  it('finds the range of the innermost cells for marks', () => {
    const r = computePivot(source(), config([{ field: 'amount', mark: 'bar' }]))
    expect(r.range(0)).toEqual({ min: 30, max: 200 })
    expect(r.values[0]!.mark).toEqual({ type: 'bar', tone: 'neutral' })
  })

  it('keeps show and mark through a packet', () => {
    const cfg = config([{ field: 'amount', show: 'percentOfTotal', mark: 'scale' }])
    const src = source()
    const r = computePivot(src, cfg)
    const back = PivotResult.unpack(JSON.parse(JSON.stringify(r.pack({ plain: true }))), src, cfg)
    expect(at(back, ['华东'], ['Q1'])).toBeCloseTo(100 / 450)
    expect(back.values[0]!.mark).toEqual({ type: 'scale', tone: 'neutral' })
  })
})

describe('filters by value', () => {
  it('keeps the top groups', () => {
    const r = computePivot(source(), {
      rows: ['region'],
      values: ['amount'],
      filters: { region: { top: { count: 2 } } },
    })
    expect(new Set([...r.rows.children].map((n) => r.rows.label(n)))).toEqual(
      new Set(['华东', '华南']),
    )
    expect(at(r, [])).toBe(420)
  })

  it('keeps the bottom groups by another value', () => {
    const r = computePivot(source(), {
      rows: ['region'],
      values: ['amount', 'cups'],
      filters: { region: { top: { count: 1, valueIndex: 1, order: 'asc' } } },
    })
    expect([...r.rows.children].map((n) => r.rows.label(n))).toEqual(['华北'])
  })

  it('keeps the groups within a range, after the lists', () => {
    const r = computePivot(source(), {
      rows: ['region'],
      values: ['amount'],
      filters: { region: { exclude: ['华东'], between: { min: 50 } } },
    })
    expect([...r.rows.children].map((n) => r.rows.label(n))).toEqual(['华南'])
  })
})

describe('DouPivot', () => {
  it('writes shares as percentages and heads them with the way of showing', async () => {
    const wrapper = mount(DouPivot, {
      props: {
        data: rows,
        fields: [
          { name: 'region', label: '大区' },
          { name: 'amount', label: '销售额', type: 'number' as const },
        ],
        config: { rows: ['region'], values: [{ field: 'amount', show: 'percentOfTotal' }] },
      },
      attachTo: document.body,
    })
    await nextTick()
    const cells = wrapper.findAll('.dou-pivot__body .dou-pivot__cell').map((c) => c.text())
    expect(cells).toContain('66.7%')
    expect(wrapper.text()).toContain('销售额 · 占总计')
    wrapper.unmount()
  })

  it('marks only the innermost cells', async () => {
    const wrapper = mount(DouPivot, {
      props: {
        data: rows,
        config: { rows: ['region', 'quarter'], values: [{ field: 'amount', mark: 'bar' }] },
      },
      attachTo: document.body,
    })
    await nextTick()
    const rowsOf = wrapper.findAll('.dou-pivot__body .dou-pivot__row')
    const levels = (marked: boolean) =>
      new Set(
        rowsOf
          .filter((r) => r.find('.has-bar').exists() === marked)
          .map((r) => r.attributes('aria-level')),
      )
    // the region rows hold subtotals; only the region-and-quarter rows are marked
    expect(levels(true)).toEqual(new Set(['2']))
    expect(levels(false)).toEqual(new Set(['1']))
    const style = wrapper.find('.has-bar').attributes('style')
    expect(style).toContain('--dou-pivot-bar-size')
    wrapper.unmount()
  })
})

describe('DouPivotFields', () => {
  it('adds a calculated value from the dialog, and says what is wrong first', async () => {
    const model = ref<PivotConfig>({ rows: ['region'], values: ['amount'] })
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouPivotFields, {
            data: rows,
            drawer: false,
            config: model.value,
            'onUpdate:config': (v: PivotConfig) => (model.value = v),
          }),
      ),
      { attachTo: document.body },
    )
    await wrapper.find('.dou-pivot-fields__add').trigger('click')
    await nextTick()
    await nextTick()
    const box = document.querySelector<HTMLTextAreaElement>('.dou-pivot-formula__box textarea')!
    box.value = 'amount / price'
    box.dispatchEvent(new Event('input'))
    await nextTick()
    expect(document.body.textContent).toContain('没有名为“price”的字段')
    box.value = 'amount / cups'
    box.dispatchEvent(new Event('input'))
    await nextTick()
    const apply = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === '确定',
    )!
    apply.click()
    await nextTick()
    expect(model.value.values).toEqual(['amount', { formula: 'amount / cups' }])
    wrapper.unmount()
  })
})

describe('the panel model', () => {
  it('sets and takes away a way of showing and a mark', () => {
    let c: PivotConfig = { values: ['amount'] }
    c = withValue(c, 0, { show: 'rank', mark: 'bar' })
    expect(c.values).toEqual([{ field: 'amount', show: 'rank', mark: 'bar' }])
    c = withValue(c, 0, { show: null, mark: null })
    expect(c.values).toEqual(['amount'])
  })

  it('sets a top N and keeps the lists', () => {
    let c: PivotConfig = { rows: ['region'], filters: { region: { exclude: ['华北'] } } }
    c = withTop(c, 'region', { count: 5 }, false)
    expect(c.filters).toEqual({ region: { exclude: ['华北'], top: { count: 5 } } })
    c = withTop(c, 'region', null, false)
    expect(c.filters).toEqual({ region: { exclude: ['华北'] } })
  })
})
