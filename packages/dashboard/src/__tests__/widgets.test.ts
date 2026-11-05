import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouDashboard, defineDashboardWidget, useDashboardWidget } from '..'
import type { DashboardDocument, DashboardExpose, DashboardFilters, DashboardSources } from '..'
import { chartWidget } from '../chart'
import { pivotWidget } from '../pivot'
import { filterValueOf, statWidget, tableWidget, textWidget, valueAt } from '../widgets'

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

const widgets = [statWidget(), textWidget(), tableWidget(), chartWidget(), pivotWidget()]

const rows = [
  { region: '华东', city: '上海', amount: 1200, orders: 3 },
  { region: '华东', city: '杭州', amount: 800, orders: 2 },
  { region: '华南', city: '广州', amount: 600, orders: 1 },
]

function setup(list: DashboardDocument['widgets'], sources: DashboardSources = {}) {
  const filters = ref<DashboardFilters>({})
  const dashboard = ref<DashboardExpose>()
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(DouDashboard, {
          ref: dashboard,
          modelValue: { version: 1, widgets: list },
          widgets,
          sources,
          filters: filters.value,
          'onUpdate:filters': (next: DashboardFilters) => (filters.value = next),
        }),
    }),
    { attachTo: document.body },
  )
  return { wrapper, filters, api: () => dashboard.value! }
}

/** A pivot cell event with these row groups. */
const cell = (row: string[]) => ({
  row,
  column: [],
  labels: { row, column: [] },
  valueIndex: 0,
  value: 0,
  records: () => [],
  indices: () => [],
})

const place = (x: number, y = 0) => ({ lg: { x, y, w: 3, h: 3 } })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('shared helpers', () => {
  it('reads dotted paths and turns dates into day text', () => {
    expect(valueAt({ total: { amount: 3 } }, 'total.amount')).toBe(3)
    expect(valueAt({ a: 1 }, 'a.b')).toBeUndefined()
    // a path that isn't text, as in JSON written by a program, finds nothing
    expect(valueAt({ a: 1 }, 0.012)).toBeUndefined()
    expect(valueAt({ a: 1 }, ['a'])).toBeUndefined()
    expect(valueAt({ a: 1 }, null)).toEqual({ a: 1 })
    expect(filterValueOf(new Date(2026, 9, 31))).toBe('2026-10-31')
    expect(filterValueOf('上海')).toBe('上海')
  })

  it('lets a definition change its type and label', () => {
    const kpi = statWidget({ type: 'kpi', label: '指标' })
    expect(kpi.type).toBe('kpi')
    expect(kpi.label).toBe('指标')
    expect(kpi.settings).toBeTruthy()
  })
})

describe('built-in widgets', () => {
  it('shows a number from a source, with its change', async () => {
    const { wrapper } = setup(
      [
        {
          id: 's',
          type: 'stat',
          props: { source: 'total', field: 'sum.amount', suffix: '元', delta: 'delta' },
          place: place(0),
        },
      ],
      { total: () => ({ sum: { amount: 2600 }, delta: 0.125 }) },
    )
    await flush()
    const text = wrapper.find('.dou-dashboard-stat').text()
    expect(text).toContain('2,600')
    expect(text).toContain('元')
    expect(text).toContain('+12.5%')
    wrapper.unmount()
  })

  it('shows a fixed number and text without a source', async () => {
    const { wrapper } = setup([
      { id: 's', type: 'stat', props: { value: 42 }, place: place(0) },
      { id: 't', type: 'text', props: { text: '戴兜\n上海', size: 'lg' }, place: place(3) },
    ])
    await flush()
    expect(wrapper.find('.dou-dashboard-stat').text()).toContain('42')
    const text = wrapper.find('.dou-dashboard-text')
    expect(text.text()).toContain('戴兜')
    expect(text.classes()).toContain('is-lg')
    wrapper.unmount()
  })

  it('shows rows in a table with the chosen columns', async () => {
    const { wrapper } = setup(
      [
        {
          id: 't',
          type: 'table',
          props: { source: 'rows', columns: [{ key: 'city', title: '城市' }, { key: 'amount' }] },
          place: place(0),
        },
      ],
      { rows: () => rows },
    )
    await flush()
    const table = wrapper.find('.dou-dashboard-table')
    expect(table.text()).toContain('城市')
    expect(table.text()).toContain('amount')
    expect(table.text()).toContain('1,200')
    expect(table.text()).not.toContain('华东')
    wrapper.unmount()
  })

  it('filters the other widgets when a chart is clicked, and clears on a second click', async () => {
    const { wrapper, filters, api } = setup(
      [
        {
          id: 'c',
          type: 'chart',
          props: { source: 'rows', kind: 'bar', x: 'region', y: ['amount'], filter: 'region' },
          place: place(0),
        },
      ],
      { rows: () => rows },
    )
    await flush()
    const chart = wrapper.findComponent({ name: 'DouChart' })
    chart.vm.$emit('select', { x: '华南', title: '华南', items: [] })
    await flush()
    expect(filters.value).toEqual({ region: '华南' })
    expect(api().linkedFilters[0]).toMatchObject({ key: 'region', widget: 'c', label: '华南' })
    chart.vm.$emit('select', { x: '华南', title: '华南', items: [] })
    await flush()
    expect(filters.value).toEqual({})
    wrapper.unmount()
  })

  it('filters by a pivot cell’s groups, one filter per field', async () => {
    const { wrapper, filters } = setup(
      [
        {
          id: 'p',
          type: 'pivot',
          props: {
            source: 'rows',
            config: { rows: ['region', 'city'], values: ['amount'] },
            filter: true,
          },
          place: place(0),
        },
      ],
      { rows: () => rows },
    )
    await flush()
    const pivot = wrapper.findComponent({ name: 'DouPivot' })
    pivot.vm.$emit('cellClick', cell(['华东', '上海']))
    await flush()
    expect(filters.value).toEqual({ region: '华东', city: '上海' })
    // one tag for both filters, clearing both
    const tags = wrapper.findAll('.dou-dashboard__links .dou-tag')
    expect(tags).toHaveLength(1)
    expect(tags[0]!.text()).toContain('华东 / 上海')
    expect(pivot.props('highlight')).toEqual({ row: ['华东', '上海'], column: [] })
    pivot.vm.$emit('cellClick', cell(['华南']))
    await flush()
    expect(filters.value).toEqual({ region: '华南' })
    pivot.vm.$emit('cellClick', cell([]))
    await flush()
    expect(filters.value).toEqual({})
    wrapper.unmount()
  })
})

describe('props of the wrong type', () => {
  it('leaves out what built-in widgets can’t use, without throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper } = setup(
      [
        {
          id: 's',
          type: 'stat',
          props: { source: 'rows', field: 'n', delta: 0.012, trend: 3, precision: 'x', prefix: 1 },
          place: place(0),
        },
        {
          id: 't',
          type: 'table',
          props: { source: 'rows', path: 'list', columns: { key: 'city' }, rowKey: 1 },
          place: place(3),
        },
        {
          id: 'c',
          type: 'chart',
          props: { source: 'rows', path: 'list', x: 1, y: 'amount', labels: 2 },
          place: place(6),
        },
        { id: 'x', type: 'text', props: { text: { a: 1 }, size: 'huge' }, place: place(9) },
      ],
      { rows: () => ({ n: 7, list: [...rows, null, 3] }) },
    )
    await flush()
    expect(wrapper.find('.dou-dashboard-stat').text()).toContain('7')
    // columns that aren't a list: every field, as with none given
    expect(wrapper.find('.dou-dashboard-table').text()).toContain('上海')
    expect(wrapper.find('.dou-dashboard-text').classes()).toContain('is-md')
    expect(wrapper.findAll('.dou-dashboard__status.is-error')).toHaveLength(0)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
    warn.mockRestore()
    wrapper.unmount()
  })

  it('shows a widget that throws as an error in its own card, and tries again when its props change', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = defineDashboardWidget<{ ok?: boolean }>({
      type: 'broken',
      label: '会出错的格子',
      component: defineComponent(() => {
        const { props } = useDashboardWidget<{ ok?: boolean }>()
        return () => {
          if (!props.value.ok) throw new Error('boom')
          return h('p', { class: 'fixed' }, '好了')
        }
      }),
    })
    const doc = ref<DashboardDocument>({
      version: 1,
      widgets: [
        { id: 'b', type: 'broken', props: {}, place: place(0) },
        { id: 't', type: 'text', props: { text: '戴兜' }, place: place(3) },
      ],
    })
    const appError = vi.fn<(error: unknown) => void>()
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouDashboard, {
            modelValue: doc.value,
            'onUpdate:modelValue': (next: DashboardDocument) => (doc.value = next),
            widgets: [broken, textWidget()],
          }),
      }),
      { attachTo: document.body, global: { config: { errorHandler: appError } } },
    )
    await flush()
    // the other widget shows; the error stays in the card and doesn't reach the app
    expect(wrapper.find('.dou-dashboard-text').text()).toContain('戴兜')
    const alert = wrapper.find('.dou-dashboard__status.is-error')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('这个格子显示出错')
    expect(appError).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"b" (broken)'), expect.any(Error))
    // retrying with the same props fails again, still in the card
    await alert.find('button').trigger('click')
    await flush()
    expect(wrapper.find('.dou-dashboard__status.is-error').exists()).toBe(true)
    // fixed props: shown again
    doc.value = {
      ...doc.value,
      widgets: doc.value.widgets.map((w) => (w.id === 'b' ? { ...w, props: { ok: true } } : w)),
    }
    await flush()
    expect(wrapper.find('.fixed').exists()).toBe(true)
    expect(wrapper.find('.dou-dashboard__status.is-error').exists()).toBe(false)
    expect(appError).not.toHaveBeenCalled()
    error.mockRestore()
    wrapper.unmount()
  })
})

describe('print', () => {
  it('draws every widget and waits for their data before printing', async () => {
    const print = vi.fn<() => void>()
    window.print = print
    let resolve!: (value: unknown) => void
    const list = Array.from({ length: 40 }, (_, i) => ({
      id: `w${i}`,
      type: 'stat',
      props: { source: 'slow', field: 'n' },
      place: { lg: { x: 0, y: i * 3, w: 3, h: 3 } },
    }))
    const { wrapper, api } = setup(list, { slow: () => new Promise((done) => (resolve = done)) })
    await flush()
    const done = api().print()
    await flush()
    // every frame is drawn in full, and printing waits for the source
    expect(wrapper.findAll('.dou-dashboard-stat')).toHaveLength(40)
    expect(print).not.toHaveBeenCalled()
    resolve({ n: 1 })
    await done
    expect(print).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
