import { parseClip } from '@dou-ui/sheet'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouPivot, type PivotCollapsed, type PivotConfig } from '../index'
import type { PivotCellEvent, PivotExpose } from '../types'
import {
  gridMerges,
  gridToCSV,
  gridToHTML,
  gridToSheetCells,
  gridToTSV,
  sheetFormat,
  tidyNumber,
} from '../core/table'

/** A value cell of a grid, for the sheet cells it makes. */
const valueCell = (v: number, valueIndex: number) => ({
  text: '',
  kind: 'value' as const,
  value: v,
  valueIndex,
})

const sales = [
  { region: '华东', city: '上海', quarter: 'Q1', amount: 10 },
  { region: '华东', city: '上海', quarter: 'Q2', amount: 20 },
  { region: '华东', city: '杭州', quarter: 'Q1', amount: 5 },
  { region: '华南', city: '广州', quarter: 'Q2', amount: 7.5 },
  { region: '华南', city: '深圳', quarter: 'Q1', amount: 3 },
]

function setup(initial: PivotConfig, extra: Record<string, unknown> = {}) {
  const config = ref(initial)
  const collapsed = ref<PivotCollapsed>({})
  const pivot = ref<PivotExpose>()
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
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  return { wrapper, config, collapsed, pivot }
}

const texts = (grid: ReturnType<PivotExpose['toGrid']>) =>
  grid.cells.map((row) => row.map((cell) => (cell ? cell.text : null)))

describe('sheetFormat', () => {
  it('writes number formats as a sheet format', () => {
    expect(sheetFormat({ maximumFractionDigits: 0 }, 'zh-CN')).toBe('#,##0')
    expect(sheetFormat({ maximumFractionDigits: 2 }, 'zh-CN')).toBe('#,##0.##')
    expect(
      sheetFormat(
        { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 },
        'zh-CN',
      ),
    ).toBe('#,##0.0%')
    expect(sheetFormat({ style: 'currency', currency: 'CNY' }, 'zh-CN')).toBe('"¥"#,##0.00')
    // a maximum below the default minimum lowers it, as Intl does
    expect(
      sheetFormat({ style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }, 'zh-CN'),
    ).toBe('"¥"#,##0')
    expect(
      sheetFormat({ style: 'currency', currency: 'CNY', maximumFractionDigits: 1 }, 'zh-CN'),
    ).toBe('"¥"#,##0.0')
    expect(sheetFormat({ useGrouping: false, minimumFractionDigits: 2 }, 'zh-CN')).toBe('0.00#')
    expect(sheetFormat({ maximumFractionDigits: 0, signDisplay: 'exceptZero' }, 'zh-CN')).toBe(
      '+#,##0;-#,##0;#,##0',
    )
    expect(sheetFormat({ style: 'unit', unit: 'kilogram' }, 'zh-CN')).toBeUndefined()
  })
})

describe('tidyNumber', () => {
  it('takes off the float noise of adding up', () => {
    expect(tidyNumber(1592.0200000000002)).toBe(1592.02)
    expect(tidyNumber(0.1 + 0.2)).toBe(0.3)
    expect(tidyNumber(Number.NaN)).toBeNaN()
    expect(tidyNumber(123456789.123)).toBe(123456789.123)
  })
})

describe('the table as cells', () => {
  it('gives each row field a column and keeps the column groups as spans', () => {
    const { pivot } = setup({
      rows: ['region', 'city'],
      columns: ['quarter'],
      values: ['amount'],
    })
    const grid = pivot.value!.toGrid()
    expect(grid.headRows).toBe(2)
    expect(grid.headCols).toBe(2)
    expect(texts(grid)).toEqual([
      ['quarter', '', 'Q1', 'Q2', '总计'],
      ['region', 'city', 'amount', 'amount', 'amount'],
      ['华东', '', '15', '20', '35'],
      ['', '杭州', '5', '', '5'],
      ['', '上海', '10', '20', '30'],
      ['华南', '', '3', '7.5', '10.5'],
      ['', '广州', '', '7.5', '7.5'],
      ['', '深圳', '3', '', '3'],
      ['总计', '', '18', '27.5', '45.5'],
    ])
    expect(grid.cells[0]![4]).toMatchObject({ text: '总计', total: true })
    expect(gridMerges(grid)).toEqual([])
    // a group's own line holds its total
    expect(grid.cells[2]![2]).toMatchObject({ value: 15, total: true })
    expect(grid.cells[3]![2]).toMatchObject({ value: 5 })
    expect(grid.cells[3]![2]!.total).toBeUndefined()
    expect(grid.cells[3]![3]!.value).toBeNaN()
  })

  it('writes CSV with values, or the text with `text`', () => {
    const { pivot } = setup({
      rows: ['region'],
      values: [{ field: 'amount', format: { style: 'currency', currency: 'CNY' } }],
    })
    const csv = pivot.value!.toCSV()
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'region,amount',
      '华东,35',
      '华南,10.5',
      '总计,45.5',
    ])
    const text = pivot.value!.toCSV({ text: true, bom: false })
    expect(text.split('\r\n')[2]).toBe('华南,¥10.50')
  })

  it("drops optional decimals a number doesn't need, so Excel shows no bare point", () => {
    const grid = {
      cells: [
        [
          valueCell(15, 0),
          valueCell(7.5, 0),
          valueCell(0.15, 1),
          valueCell(0.155, 1),
          valueCell(2, 2),
        ],
      ],
      headRows: 0,
      headCols: 0,
      formats: ['#,##0.##', '#,##0.#%', '0.0#'],
      widths: [80, 80, 80, 80, 80],
    }
    expect(gridToSheetCells(grid)).toEqual([
      [
        { value: 15, format: '#,##0' },
        { value: 7.5, format: '#,##0.##' },
        // 15%: the percentage needs no decimals
        { value: 0.15, format: '#,##0%' },
        { value: 0.155, format: '#,##0.#%' },
        { value: 2, format: '0.0' },
      ],
    ])
  })

  it('keeps labels a spreadsheet would read as formulas as text', () => {
    const grid = {
      cells: [
        [
          { text: '=1+1', kind: 'label' as const },
          { text: '-1', kind: 'value' as const, value: -1, valueIndex: 0 },
        ],
      ],
      headRows: 0,
      headCols: 1,
      formats: [undefined],
      widths: [100, 100],
    }
    expect(gridToCSV(grid, { bom: false })).toBe("'=1+1,-1")
    expect(gridToCSV(grid, { bom: false, escapeFormulas: false })).toBe('=1+1,-1')
    expect(gridToTSV(grid)).toBe('=1+1\t-1')
  })

  it('makes a workbook for DouSheet with formats, merges and frozen headers', () => {
    const { pivot } = setup({
      rows: ['region'],
      columns: ['quarter'],
      values: [{ field: 'amount', show: 'percentOfTotal' }],
    })
    const book = pivot.value!.toSheet({ name: '销售' })
    const sheet = book.sheets[0]!
    expect(sheet.name).toBe('销售')
    expect(sheet.freeze).toEqual({ rows: 2, cols: 1 })
    expect(sheet.merges).toEqual([])
    expect(sheet.cells[0]).toEqual([
      { value: 'quarter', style: 'pivot-head' },
      { value: 'Q1', style: 'pivot-head' },
      { value: 'Q2', style: 'pivot-head' },
      { value: '总计', style: 'pivot-head' },
    ])
    expect(sheet.cells[2]![1]).toEqual({ value: tidyNumber(15 / 45.5), format: '#,##0.0%' })
    expect(sheet.cells[4]![3]).toEqual({ value: 1, format: '#,##0.0%', style: 'pivot-total' })
    expect(Object.keys(sheet.colSizes)).toHaveLength(4)
    expect(book.styles['pivot-total']).toEqual({ bold: true })
  })

  it('gives a chart a row per group on show and a series per column', async () => {
    const { pivot, collapsed } = setup({
      rows: ['region', 'city'],
      columns: ['quarter'],
      values: ['amount'],
    })
    let chart = pivot.value!.toChartRows()
    expect(chart.x).toBe('label')
    expect(chart.series).toMatchObject([
      { key: 's0', name: 'Q1', valueIndex: 0 },
      { key: 's1', name: 'Q2', valueIndex: 0 },
    ])
    // the numbers written as the table writes them, for the axis
    expect(chart.series[0]!.format(1234.5)).toBe('1,234.5')
    expect(chart.rows.map((r) => r.label)).toEqual([
      '华东 · 杭州',
      '华东 · 上海',
      '华南 · 广州',
      '华南 · 深圳',
    ])
    expect(chart.rows[0]).toEqual({ label: '华东 · 杭州', s0: 5, s1: null })
    // a closed group is one row
    collapsed.value = { rows: [['华东']] }
    await nextTick()
    chart = pivot.value!.toChartRows()
    expect(chart.rows.map((r) => r.label)).toEqual(['华东', '华南 · 广州', '华南 · 深圳'])
    expect(chart.rows[0]).toEqual({ label: '华东', s0: 15, s1: 20 })
  })

  it('names each series by its value when there are no column fields', () => {
    const { pivot } = setup({
      rows: ['region'],
      values: ['amount', { aggregate: 'count' }],
    })
    const chart = pivot.value!.toChartRows()
    expect(chart.series.map((s) => s.name)).toEqual(['amount', '计数'])
    expect(chart.rows).toEqual([
      { label: '华东', s0: 35, s1: 3 },
      { label: '华南', s0: 10.5, s1: 2 },
    ])
    expect(pivot.value!.toChartRows({ valueIndex: 1 }).series).toMatchObject([
      { key: 's0', name: '计数', valueIndex: 1 },
    ])
  })
})

const copyEvent = () => {
  const data = new Map<string, string>()
  const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: { setData: (type: string, value: string) => data.set(type, value) },
  })
  return { event, data }
}

describe('selecting and copying', () => {
  it('grows a range with Shift and the arrows, and copies it as text and a table', async () => {
    const { wrapper } = setup({ rows: ['region'], columns: ['quarter'], values: ['amount'] })
    const view = wrapper.find('.dou-pivot__viewport')
    await view.trigger('focus')
    await view.trigger('keydown', { key: 'ArrowRight' })
    await view.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await view.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(wrapper.findAll('.dou-pivot__cell.is-selected')).toHaveLength(4)
    expect(wrapper.findAll('[role="gridcell"][aria-selected="true"]')).toHaveLength(4)
    expect(view.attributes('aria-multiselectable')).toBe('true')
    // read out once the range stops growing
    await new Promise((done) => setTimeout(done, 450))
    expect(wrapper.find('.dou-pivot__live').text()).toBe('已选中 2 行 2 列')
    const { event, data } = copyEvent()
    view.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(data.get('text/plain')).toBe('15\t20\n3\t7.5')
    await new Promise((done) => setTimeout(done, 80))
    expect(wrapper.find('.dou-pivot__live').text()).toBe('已复制 4 个格子')
    // DouSheet reads the numbers back as numbers
    const clip = parseClip({ html: data.get('text/html') })!
    // whole numbers drop the optional decimals, which Excel would show as a trailing point
    const f = '#,##0.##'
    expect(clip.cells).toEqual([
      [
        { value: 15, format: '#,##0' },
        { value: 20, format: '#,##0' },
      ],
      [
        { value: 3, format: '#,##0' },
        { value: 7.5, format: f },
      ],
    ])
    await view.trigger('keydown', { key: 'Escape' })
    expect(wrapper.findAll('.is-selected')).toHaveLength(0)
  })

  it('copies the whole table with its headers after selecting all', async () => {
    const { wrapper } = setup({ rows: ['region'], columns: ['quarter'], values: ['amount'] })
    const view = wrapper.find('.dou-pivot__viewport')
    await view.trigger('focus')
    await view.trigger('keydown', { key: 'a', ctrlKey: true })
    expect(wrapper.findAll('.dou-pivot__row-head.is-selected').length).toBeGreaterThan(0)
    const { event, data } = copyEvent()
    view.element.dispatchEvent(event)
    expect(data.get('text/plain')!.split('\n')).toEqual([
      'quarter\tQ1\tQ2\t总计',
      'region\tamount\tamount\tamount',
      '华东\t15\t20\t35',
      '华南\t3\t7.5\t10.5',
      '总计\t18\t27.5\t45.5',
    ])
    const clip = parseClip({ html: data.get('text/html') })!
    expect(clip.cells[2]).toEqual([
      '华东',
      { value: 15, format: '#,##0' },
      { value: 20, format: '#,##0' },
      { value: 35, format: '#,##0', style: 'pivot-total' },
    ])
    expect(clip.styles?.['pivot-head']).toEqual({ bold: true })
  })

  it('copies the active cell without a range, and a row header with its labels', async () => {
    const { wrapper } = setup({ rows: ['region', 'city'], values: ['amount'] })
    const view = wrapper.find('.dou-pivot__viewport')
    await view.trigger('focus')
    await view.trigger('keydown', { key: 'ArrowDown' })
    let copied = copyEvent()
    view.element.dispatchEvent(copied.event)
    expect(copied.data.get('text/plain')).toBe('\t杭州')
    await view.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    copied = copyEvent()
    view.element.dispatchEvent(copied.event)
    expect(copied.data.get('text/plain')).toBe('\t杭州\t5')
  })

  it('drags over cells to pick a range, and the drag opens no details', async () => {
    const clicks: unknown[] = []
    const { wrapper } = setup(
      { rows: ['region'], columns: ['quarter'], values: ['amount'] },
      { onCellClick: (cell: unknown) => clicks.push(cell) },
    )
    const cells = wrapper.findAll('.dou-pivot__body .dou-pivot__cell')
    const first = cells[0]!.element
    const last = cells[cells.length - 1]!.element
    first.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
    )
    const original = document.elementFromPoint
    document.elementFromPoint = () => last
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    document.elementFromPoint = original
    window.dispatchEvent(new PointerEvent('pointerup'))
    await nextTick()
    expect(wrapper.findAll('.dou-pivot__cell.is-selected')).toHaveLength(6)
    wrapper
      .find('.dou-pivot__body')
      .element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicks).toHaveLength(0)
  })
})

describe('gridToHTML', () => {
  it('puts the headers in thead with their spans, and escapes text', () => {
    const html = gridToHTML({
      cells: [
        [{ text: 'a<b', kind: 'head', colSpan: 2 }, null],
        [
          { text: 'x', kind: 'label' },
          { text: '1', kind: 'value', value: 1, valueIndex: 0 },
        ],
      ],
      headRows: 1,
      headCols: 1,
      formats: [undefined],
      widths: [80, 80],
    })
    expect(html).toContain('<thead><tr><th colspan="2" class="is-head">a&#60;b</th></tr></thead>')
    expect(html).toContain('<th scope="row" class="is-label is-edge">x</th>')
    expect(html).not.toContain('data-dou-sheet')
  })
})

describe('cellClick labels', () => {
  it('gives the groups as the table writes them beside their values', async () => {
    const clicks: PivotCellEvent<unknown>[] = []
    const dated = [
      { day: new Date(2026, 0, 5), channel: '外卖', amount: 10 },
      { day: new Date(2026, 1, 9), channel: '门店', amount: 4 },
    ]
    const wrapper = mount(DouPivot, {
      props: {
        data: dated,
        fields: [{ name: 'day', type: 'date' }],
        config: { rows: [{ field: 'day', by: 'month' }], columns: ['channel'], values: ['amount'] },
        onCellClick: (cell: PivotCellEvent<unknown>) => clicks.push(cell),
      },
      attachTo: document.body,
    })
    await wrapper.findAll('.dou-pivot__body .dou-pivot__cell')[0]!.trigger('click')
    expect(clicks[0]!.row).toEqual(['2026-01'])
    expect(clicks[0]!.labels).toEqual({ row: ['2026年1月'], column: ['门店'] })
    wrapper.unmount()
  })
})
