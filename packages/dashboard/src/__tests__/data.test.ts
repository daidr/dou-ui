import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  DouDashboard,
  DouDashboardFilterBar,
  defineDashboardWidget,
  isEmptyFilter,
  useDashboardWidget,
} from '..'
import type { DashboardDocument, DashboardExpose, DashboardFilters, DashboardSources } from '..'
import { createSourceStore } from '../data/store'
import { pickFilters, stableKey } from '../data/filters'

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

describe('filters', () => {
  it('leaves out empty values', () => {
    expect(isEmptyFilter('')).toBe(true)
    expect(isEmptyFilter([])).toBe(true)
    expect(isEmptyFilter([null, null])).toBe(true)
    expect(isEmptyFilter(0)).toBe(false)
    expect(pickFilters({ a: 1, b: '', c: [], d: 'x' })).toEqual({ a: 1, d: 'x' })
    expect(pickFilters({ a: 1, d: 'x' }, ['d'])).toEqual({ d: 'x' })
    expect(pickFilters({ a: 1, d: 'x' }, undefined, new Set(['a']))).toEqual({ d: 'x' })
  })

  it('gives equal filters the same key, whatever the order', () => {
    expect(stableKey({ b: [1, 2], a: { y: 1, x: 2 } })).toBe(
      stableKey({ a: { x: 2, y: 1 }, b: [1, 2] }),
    )
    expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: '1' }))
  })
})

describe('source store', () => {
  it('loads once for each source and filters, and aborts loads nobody waits for', async () => {
    const signals: AbortSignal[] = []
    const load = vi.fn<(context: any) => unknown>(({ signal }: { signal: AbortSignal }) => {
      signals.push(signal)
      return new Promise(() => {})
    })
    const store = createSourceStore(() => ({ sales: load }))
    const a = store.use('sales', { region: '华东' })
    const b = store.use('sales', { region: '华东' })
    expect(a.entry).toBe(b.entry)
    expect(load).toHaveBeenCalledTimes(1)
    a.release()
    expect(signals[0]!.aborted).toBe(false)
    b.release()
    expect(signals[0]!.aborted).toBe(true)
    store.dispose()
  })

  it('passes only the filters a source uses, and keeps results to come back to', async () => {
    const load = vi.fn<(context: any) => unknown>(({ filters }: { filters: DashboardFilters }) => ({
      ...filters,
    }))
    const store = createSourceStore(() => ({ sales: { load, filters: ['region'] } }))
    const a = store.use('sales', { region: '华东', keyword: '上海' })
    await flush()
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { region: '华东' } }))
    expect(a.entry.state.value).toEqual({ status: 'ready', data: { region: '华东' } })
    a.release()
    // another keyword: same filters for this source, nothing to load
    const b = store.use('sales', { region: '华东', keyword: '杭州' })
    expect(b.entry).toBe(a.entry)
    expect(load).toHaveBeenCalledTimes(1)
    store.dispose()
  })

  it('refreshes on its interval, but not while the page is hidden', async () => {
    vi.useFakeTimers()
    let hidden = false
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })
    let n = 0
    const store = createSourceStore(() => ({ live: { load: () => ++n, refresh: 1000 } }))
    const handle = store.use('live', {})
    await vi.advanceTimersByTimeAsync(0)
    expect(handle.entry.state.value).toEqual({ status: 'ready', data: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(handle.entry.state.value).toEqual({ status: 'ready', data: 2 })
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(3000)
    expect(n).toBe(2)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(n).toBe(3)
    handle.release()
    await vi.advanceTimersByTimeAsync(5000)
    expect(n).toBe(3)
    store.dispose()
    vi.useRealTimers()
    delete (document as any).visibilityState
  })
})

// ---------------------------------------------------------------------------

const Chart = defineComponent({
  setup() {
    const { data, setFilter, filters } = useDashboardWidget<{ source: string }, string[]>()
    return () =>
      h('div', { class: 'chart' }, [
        h('span', { class: 'rows' }, (data.value ?? []).join(',')),
        h('span', { class: 'filters' }, JSON.stringify(filters.value)),
        h('button', {
          class: 'pick',
          onClick: () => setFilter('region', 'east', { label: '华东' }),
        }),
      ])
  },
})

const widgets = [
  defineDashboardWidget({ type: 'chart', label: '图表', size: { w: 3, h: 2 }, component: Chart }),
]

function board(count: number, sourceCount: number): DashboardDocument {
  return {
    version: 1,
    widgets: Array.from({ length: count }, (_, i) => ({
      id: `w${i}`,
      type: 'chart',
      props: { source: `s${i % sourceCount}` },
      place: { lg: { x: (i % 4) * 3, y: Math.floor(i / 4) * 2, w: 3, h: 2 } },
    })),
  }
}

function setup(doc: DashboardDocument, sources: DashboardSources) {
  const filters = ref<DashboardFilters>({})
  const wrapper = mount(
    defineComponent({
      setup: () => () => [
        h(DouDashboardFilterBar, {
          for: (dashboard.value ?? null) as DashboardExpose | null,
          fields: [{ type: 'select', key: 'region', label: '地区', options: ['east', 'west'] }],
        }),
        h(DouDashboard, {
          ref: dashboard,
          modelValue: doc,
          widgets,
          sources,
          filters: filters.value,
          'onUpdate:filters': (next: DashboardFilters) => (filters.value = next),
        }),
      ],
    }),
    { attachTo: document.body },
  )
  return { wrapper, filters, api: () => dashboard.value as DashboardExpose }
}
const dashboard = ref<DashboardExpose>()

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouDashboard data', () => {
  it('loads 30 widgets from 5 sources with 5 loads, and again 5 when a filter changes', async () => {
    const load = vi.fn<(context: any) => unknown>(
      ({ source, filters }: { source: string; filters: DashboardFilters }) =>
        Promise.resolve([source, String(filters.region ?? 'all')]),
    )
    const sources = Object.fromEntries(['s0', 's1', 's2', 's3', 's4'].map((name) => [name, load]))
    const { wrapper, api, filters } = setup(board(30, 5), sources)
    await flush()
    expect(load).toHaveBeenCalledTimes(5)
    expect(wrapper.findAll('.rows')[0]!.text()).toBe('s0,all')
    api().setFilter('region', 'west')
    await flush()
    expect(filters.value).toEqual({ region: 'west' })
    expect(load).toHaveBeenCalledTimes(10)
    expect(wrapper.findAll('.rows')[6]!.text()).toBe('s1,west')
    wrapper.unmount()
  })

  it('keeps the last data and shows loading while new data loads', async () => {
    let resolve!: (rows: string[]) => void
    const sources = {
      s0: ({ filters }: { filters: DashboardFilters }) =>
        filters.region ? new Promise<string[]>((done) => (resolve = done)) : ['first'],
    }
    const { wrapper, api } = setup(board(1, 1), sources)
    await flush()
    expect(wrapper.find('.rows').text()).toBe('first')
    api().setFilter('region', 'east')
    await flush()
    expect(wrapper.find('.rows').text()).toBe('first')
    expect(wrapper.find('.dou-dashboard__status.is-loading').exists()).toBe(true)
    resolve(['second'])
    await flush()
    expect(wrapper.find('.rows').text()).toBe('second')
    expect(wrapper.find('.dou-dashboard__status').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an error with a retry button that loads again', async () => {
    let fail = true
    const load = vi.fn<(context: any) => unknown>(() =>
      fail ? Promise.reject(new Error('down')) : ['ok'],
    )
    const { wrapper } = setup(board(1, 1), { s0: load })
    await flush()
    const status = wrapper.find('.dou-dashboard__status.is-error')
    expect(status.exists()).toBe(true)
    fail = false
    await status.find('button').trigger('click')
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.rows').text()).toBe('ok')
    wrapper.unmount()
  })

  it('applies a filter set by a widget to the others, not to itself', async () => {
    const load = vi.fn<(context: any) => unknown>(({ filters }: { filters: DashboardFilters }) => [
      String(filters.region ?? 'all'),
    ])
    const { wrapper, filters, api } = setup(board(2, 1), { s0: load })
    await flush()
    await wrapper.findAll('.pick')[0]!.trigger('click')
    await flush()
    expect(filters.value).toEqual({ region: 'east' })
    const rows = wrapper.findAll('.rows').map((row) => row.text())
    expect(rows).toEqual(['all', 'east'])
    expect(wrapper.findAll('.filters').map((f) => f.text())).toEqual(['{}', '{"region":"east"}'])
    // the title bar of the widget that set it shows it, with a button to clear it
    const tag = wrapper.findAll('.dou-dashboard__widget')[0]!.find('.dou-dashboard__links .dou-tag')
    expect(tag.text()).toContain('已按 华东 筛选')
    expect(api().linkedFilters).toHaveLength(1)
    await tag.find('button').trigger('click')
    await flush()
    expect(filters.value).toEqual({})
    expect(api().linkedFilters).toHaveLength(0)
    wrapper.unmount()
  })

  it('forgets which widget set a filter once it is changed elsewhere', async () => {
    const { wrapper, filters, api } = setup(board(2, 1), { s0: () => [] })
    await flush()
    await wrapper.findAll('.pick')[0]!.trigger('click')
    await flush()
    api().setFilter('region', 'west')
    await flush()
    expect(filters.value).toEqual({ region: 'west' })
    expect(api().linkedFilters).toHaveLength(0)
    expect(wrapper.findAll('.filters').map((f) => f.text())).toEqual([
      '{"region":"west"}',
      '{"region":"west"}',
    ])
    wrapper.unmount()
  })

  it('clears every filter from the filter bar', async () => {
    const { wrapper, filters, api } = setup(board(1, 1), { s0: () => [] })
    api().setFilter('region', 'east')
    await flush()
    const clear = wrapper.find('.dou-dashboard-filter__clear')
    expect(clear.exists()).toBe(true)
    await clear.trigger('click')
    await flush()
    expect(filters.value).toEqual({})
    wrapper.unmount()
  })
})
