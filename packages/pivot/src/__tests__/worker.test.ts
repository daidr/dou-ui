import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  computePivot,
  defineAggregator,
  PivotResult,
  PivotSource,
  type PivotConfig,
  type PivotEngine,
} from '../engine'
import { DouPivot, DouPivotFields } from '../index'
import { createPivotWorker, servePivot, type PivotWorkerLike } from '../worker'

const regions = ['华东', '华南', '华北']
const rows = Array.from({ length: 300 }, (_, i) => ({
  region: regions[i % 3]!,
  city: `城市 ${i % 7}`,
  day: new Date(2026, i % 12, 1 + (i % 28)),
  amount: i % 50,
}))

/** A worker in the same thread: messages are cloned (and moved) as `postMessage` does. */
function fakeWorker(options?: Parameters<typeof servePivot>[0]) {
  const listeners: ((event: MessageEvent) => void)[] = []
  const sent: string[] = []
  let deliver: ((event: MessageEvent) => void) | null = null
  const scope = {
    addEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => {
      deliver = listener
    },
    postMessage(message: unknown, transfer?: Transferable[]) {
      const data = structuredClone(message, { transfer })
      setTimeout(() => listeners.forEach((l) => l({ data } as MessageEvent)))
    },
  }
  servePivot(options, scope)
  const worker: PivotWorkerLike = {
    postMessage(message, transfer) {
      sent.push((message as { type: string }).type)
      const data = structuredClone(message, { transfer })
      setTimeout(() => deliver?.({ data } as MessageEvent))
    },
    addEventListener: (type: string, listener: (event: never) => void) => {
      if (type === 'message') listeners.push(listener as (event: MessageEvent) => void)
    },
  }
  return { worker, sent }
}

const cityInRegion = (r: PivotResult) => r.get(r.rows.find(['城市 1']), r.columns.find(['华南']))

const table = (r: PivotResult) =>
  Array.from(r.rows.children, (node) => [r.rows.label(node), r.get(node, 0, 0), r.get(node, 0, 1)])

describe('columns as data', () => {
  it('sums up records given column by column like records given as objects', () => {
    const columns = {
      region: rows.map((r) => r.region),
      city: rows.map((r) => r.city),
      day: rows.map((r) => r.day),
      amount: Float64Array.from(rows, (r) => r.amount),
    }
    const config = {
      rows: ['region'],
      columns: [{ field: 'day', by: 'quarter' as const }],
      values: ['amount', { field: 'city', aggregate: 'distinct' }],
    }
    const fromRows = computePivot(new PivotSource(rows, { locale: 'zh-CN' }), config)
    const source = new PivotSource(columns, { locale: 'zh-CN' })
    expect(source.length).toBe(300)
    expect(source.field('amount').type).toBe('number')
    expect(source.record(4)).toEqual({ ...rows[4] })
    expect(table(computePivot(source, config))).toEqual(table(fromRows))
  })
})

describe('packets', () => {
  it('make the same result again, from typed arrays or from JSON', () => {
    const source = new PivotSource(rows, { locale: 'zh-CN' })
    const config = { rows: ['region', 'city'], columns: ['day'], values: ['amount'] }
    const result = computePivot(source, config)
    const packet = result.pack()
    const again = PivotResult.unpack(structuredClone(packet), source, config)
    const json = PivotResult.unpack(
      JSON.parse(JSON.stringify(result.pack({ plain: true }))),
      source,
      config,
    )
    for (const r of [again, json]) {
      expect(r.rows.size).toBe(result.rows.size)
      expect(r.rows.path(5)).toEqual(result.rows.path(5))
      expect(r.columns.label(3)).toEqual(result.columns.label(3))
      expect(r.columns.find([rows[0]!.day])).toBe(result.columns.find([rows[0]!.day]))
      expect(r.get(2, 4)).toBe(result.get(2, 4))
      expect(r.indices(1, 0)).toEqual(result.indices(1, 0))
    }
  })
})

describe('createPivotWorker', () => {
  it('sends each field once, then only configs', async () => {
    const { worker, sent } = fakeWorker()
    const engine = createPivotWorker(worker)
    const source = new PivotSource(rows, { locale: 'zh-CN' })
    const config = { rows: ['region'], values: ['amount', { field: 'city', aggregate: 'count' }] }
    const local = computePivot(source, config)
    expect(table(await engine.compute(source, config))).toEqual(table(local))
    expect(sent).toEqual(['source', 'dimension', 'dimension', 'measure', 'compute'])

    sent.length = 0
    const swapped = { ...config, rows: ['city'], columns: ['region'] }
    const result = await engine.compute(source, swapped)
    expect(sent).toEqual(['compute'])
    expect(cityInRegion(result)).toBe(cityInRegion(computePivot(source, swapped)))
  })

  it('asks for what a custom aggregator reads, and drops stale configs', async () => {
    const first = defineAggregator<unknown[], 'value'>({
      name: 'first',
      input: 'value',
      init: () => [],
      add: (s, v) => (s.length ? s : [v]),
      merge: (a, b) => (a.length ? a : b),
      result: () => 1,
    })
    const { worker, sent } = fakeWorker({ aggregators: [first] })
    const engine = createPivotWorker(worker)
    const source = new PivotSource(rows)
    const stale = new AbortController()
    const old = engine.compute(source, { rows: ['region'] }, { signal: stale.signal })
    stale.abort()
    const dropped = old.catch((error: Error) => error.name)
    const result = await engine.compute(source, {
      rows: ['region'],
      values: [{ field: 'city', aggregate: 'first' }],
    })
    expect(await dropped).toBe('AbortError')
    expect(result.get(0, 0)).toBe(1)
    expect(sent).toContain('dimension')
  })
})

describe('DouPivot with an engine', () => {
  it('shows what the engine sends, the last result staying while the next is on its way', async () => {
    const { worker } = fakeWorker()
    const inner = createPivotWorker(worker)
    let calls = 0
    const engine: PivotEngine = {
      compute: (source, config, request) => (calls++, inner.compute(source, config, request)),
    }
    const config = ref<PivotConfig>({ rows: ['region'], values: ['amount'] })
    const wrapper = mount(
      defineComponent(() => () => h(DouPivot, { data: rows, engine, config: config.value })),
      { attachTo: document.body },
    )
    const heads = () =>
      wrapper.findAll('.dou-pivot__body .dou-pivot__row-head').map((e) => e.text())
    await until(() => heads().length > 0)
    const first = heads()
    expect(new Set(first)).toEqual(new Set(['华东', '华南', '华北']))

    config.value = { rows: ['city'], values: ['amount'] }
    await nextTick()
    // the old rows stay until the new ones come
    expect(heads()).toEqual(first)
    await until(() => heads().join() !== first.join())
    expect(heads()).not.toEqual(first)
    expect(calls).toBe(2)
    wrapper.unmount()
  })
})

async function until(ok: () => boolean) {
  for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 5))
  await nextTick()
}

describe('DouPivotFields with columns', () => {
  it('lists the columns and filters by their values', async () => {
    const data = {
      region: ['华东', '华南', '华东'],
      amount: Float64Array.of(1, 2, 3),
    }
    const wrapper = mount(DouPivotFields, {
      props: { data, drawer: false, config: { rows: ['region'], values: ['amount'] } },
      attachTo: document.body,
    })
    const names = wrapper.findAll('.dou-pivot-fields__field').map((e) => e.text())
    expect(names.some((n) => n.includes('region'))).toBe(true)
    expect(names.some((n) => n.includes('amount'))).toBe(true)
    wrapper.unmount()
  })
})

describe('when the worker cannot start', () => {
  it('rejects pending and later computes', async () => {
    let fail: ((event: Event) => void) | null = null
    const worker: PivotWorkerLike = {
      postMessage() {},
      addEventListener: (type: string, listener: (event: never) => void) => {
        if (type === 'error') fail = listener as (event: Event) => void
      },
    }
    const engine = createPivotWorker(worker)
    const source = new PivotSource(rows)
    const pending = engine.compute(source, { rows: ['region'] })
    const caught = pending.catch((e: Error) => e)
    await new Promise((r) => setTimeout(r, 20))
    fail!(new Event('error'))
    expect(await caught).toBeInstanceOf(Error)
    await expect(engine.compute(source, { rows: ['city'] })).rejects.toThrow(
      '[DouPivot] worker 无法启动',
    )
  })

  it('sums up on the page instead', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouPivot, {
      props: { data: rows, worker: true, config: { rows: ['region'], values: ['amount'] } },
      attachTo: document.body,
    })
    const heads = () =>
      wrapper.findAll('.dou-pivot__body .dou-pivot__row-head').map((e) => e.text())
    await until(() => heads().length > 0)
    expect(new Set(heads())).toEqual(new Set(['华东', '华南', '华北']))
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    wrapper.unmount()
  })
})
