import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouPivot, type PivotCellEvent, type PivotCollapsed, type PivotConfig } from '../index'
import type { PivotExpose } from '../types'
import { columnLines, headerSpans } from '../core/layout'
import { computePivot, PivotSource } from '../engine'

const sales = [
  { region: '华东', city: '上海', quarter: 'Q1', amount: 10 },
  { region: '华东', city: '上海', quarter: 'Q2', amount: 20 },
  { region: '华东', city: '杭州', quarter: 'Q1', amount: 5 },
  { region: '华南', city: '广州', quarter: 'Q2', amount: 7 },
  { region: '华南', city: '深圳', quarter: 'Q1', amount: 3 },
  { region: '华南', city: '深圳', quarter: 'Q2', amount: null },
]

function setup(initial: PivotConfig, extra: Record<string, unknown> = {}) {
  const config = ref(initial)
  const collapsed = ref<PivotCollapsed>({})
  const pivot = ref<PivotExpose>()
  const clicks: PivotCellEvent[] = []
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouPivot, {
          ref: pivot,
          data: sales,
          config: config.value,
          'onUpdate:config': (value: PivotConfig) => (config.value = value),
          collapsed: collapsed.value,
          'onUpdate:collapsed': (value: PivotCollapsed) => (collapsed.value = value),
          onCellClick: (cell: PivotCellEvent) => clicks.push(cell),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  const rowHeads = () =>
    wrapper.findAll('.dou-pivot__body .dou-pivot__row-head').map((el) => el.text())
  const row = (index: number) => {
    const line = wrapper.findAll('.dou-pivot__body .dou-pivot__row')[index]!
    return line.findAll('.dou-pivot__cell').map((el) => el.text())
  }
  const foot = () => wrapper.findAll('.dou-pivot__foot .dou-pivot__cell').map((el) => el.text())
  return { wrapper, config, collapsed, pivot, clicks, rowHeads, row, foot }
}

describe('DouPivot', () => {
  it('shows groups as a tree with subtotals on their own rows, and the grand total at the bottom', () => {
    const { rowHeads, row, foot, wrapper } = setup({
      rows: ['region', 'city'],
      columns: ['quarter'],
      values: ['amount'],
    })
    expect(rowHeads()).toEqual(['华东', '杭州', '上海', '华南', '广州', '深圳'])
    // Q1, Q2, total
    expect(row(0)).toEqual(['15', '20', '35'])
    expect(row(1)).toEqual(['5', '', '5'])
    expect(foot()).toEqual(['18', '27', '45'])
    const heads = wrapper.findAll('.dou-pivot__col-head').map((el) => el.text())
    expect(heads).toEqual(['Q1', 'Q2', '总计', 'amount', 'amount', 'amount'])
    expect(wrapper.find('[role="treegrid"]').attributes('aria-rowcount')).toBe(String(2 + 7))
  })

  it('collapses and expands groups by click, by key and through the ref', async () => {
    const { rowHeads, collapsed, wrapper, pivot } = setup({
      rows: ['region', 'city'],
      values: ['amount'],
    })
    await wrapper.findAll('.dou-pivot__body .dou-pivot__row-head')[0]!.trigger('click')
    expect(collapsed.value.rows).toEqual([['华东']])
    expect(rowHeads()).toEqual(['华东', '华南', '广州', '深圳'])

    const grid = wrapper.find('[role="treegrid"]')
    await grid.trigger('focus')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    expect(collapsed.value.rows).toEqual([])
    await grid.trigger('keydown', { key: 'ArrowDown' })
    await grid.trigger('keydown', { key: 'ArrowLeft' })
    // from a city, ← goes up to its region
    expect(grid.attributes('aria-activedescendant')).toMatch(/-0--1$/)

    pivot.value!.collapseAll('rows')
    await nextTick()
    expect(rowHeads()).toEqual(['华东', '华南'])
    pivot.value!.expandAll()
    await nextTick()
    expect(rowHeads()).toHaveLength(6)
  })

  it('sorts row groups by a column when its header is clicked: down, up, then by label', async () => {
    const { rowHeads, config, wrapper } = setup({
      rows: ['city'],
      columns: ['quarter'],
      values: ['amount'],
    })
    const totalHead = () => wrapper.findAll('.dou-pivot__col-head.is-value').at(-1)!
    await totalHead().trigger('click')
    expect(config.value.sort).toEqual({ value: 0, column: [], order: 'desc' })
    expect(rowHeads()).toEqual(['上海', '广州', '杭州', '深圳'])
    expect(totalHead().attributes('aria-sort')).toBe('descending')
    await totalHead().trigger('click')
    expect(rowHeads()).toEqual(['深圳', '杭州', '广州', '上海'])
    await totalHead().trigger('click')
    expect(config.value.sort).toBeNull()
    expect(rowHeads()).toEqual(['广州', '杭州', '上海', '深圳'])

    await wrapper.find('[data-sort-field="0"]').trigger('click')
    expect(config.value.rows).toEqual([{ field: 'city', sort: 'desc' }])
    expect(rowHeads()).toEqual(['深圳', '上海', '杭州', '广州'])
  })

  it('puts several values on the rows, and reports clicked cells with their records', async () => {
    const { wrapper, clicks } = setup({
      rows: ['region'],
      values: ['amount', { aggregate: 'count', label: '笔数' }],
      valuesOn: 'rows',
    })
    const values = wrapper.findAll('.dou-pivot__body .dou-pivot__value-head').map((el) => el.text())
    expect(values).toEqual(['amount', '笔数', 'amount', '笔数'])
    await wrapper.findAll('.dou-pivot__body .dou-pivot__cell')[3]!.trigger('click')
    const cell = clicks[0]!
    expect(cell.row).toEqual(['华南'])
    expect(cell.column).toEqual([])
    expect(cell.value).toBe(1)
    expect(cell.number).toBe(3)
    expect(cell.records()).toEqual([3, 4, 5])
  })

  it('counts records when there are no values and says when nothing passes the filters', async () => {
    const { foot, wrapper, config } = setup({ rows: ['region'] })
    expect(foot()).toEqual(['6'])
    expect(wrapper.find('.dou-pivot__col-head').text()).toBe('计数')
    config.value = { rows: ['region'], filters: { region: { include: ['华北'] } } }
    await nextTick()
    expect(wrapper.find('.dou-pivot__empty').text()).toBe('没有数据')
  })

  it('does not sum up again when only the sort or the labels change', async () => {
    const { pivot, config } = setup({ rows: ['city'], values: ['amount'] })
    const first = pivot.value!.result
    config.value = { ...config.value, sort: { value: 0, order: 'desc' } }
    await nextTick()
    config.value = { ...config.value, values: [{ field: 'amount', label: '金额' }] }
    await nextTick()
    expect(pivot.value!.result).toBe(first)
    config.value = { ...config.value, rows: ['region'] }
    await nextTick()
    expect(pivot.value!.result).not.toBe(first)
  })
})

describe('layout', () => {
  it('heads open groups over their children, closed ones and subtotals down to the values', () => {
    const result = computePivot(new PivotSource(sales), {
      columns: ['region', 'city'],
      values: ['amount'],
    })
    const tree = result.columns
    const closed = new Set([tree.find(['华南'])])
    const lines = columnLines(tree, closed, { values: 1, valuesHere: true, total: true })
    expect(lines.map((l) => [l.kind, tree.path(l.node).join('/')])).toEqual([
      ['group', '华东/上海'],
      ['group', '华东/杭州'],
      ['subtotal', '华东'],
      ['group', '华南'],
      ['total', ''],
    ])
    const spans = headerSpans(tree, lines, true)
    expect(spans[0]!.map((s) => [s.kind, s.from, s.to, s.rows])).toEqual([
      ['group', 0, 2, 1],
      ['subtotal', 2, 3, 2],
      ['group', 3, 4, 2],
      ['total', 4, 5, 2],
    ])
    expect(spans[1]!.map((s) => [s.from, s.to])).toEqual([
      [0, 1],
      [1, 2],
    ])
    expect(spans[2]).toHaveLength(5)
  })
})
