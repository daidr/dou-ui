import { csvExporter, defineSheetExporter, type SheetWorkbook } from '@dou-ui/sheet/core'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { defineDashboardWidget, DouDashboard, useDashboardWidget } from '..'
import type { DashboardDocument, DashboardExportErrorEvent, DashboardExpose } from '..'
import { chartWidget } from '../chart'
import { pivotWidget } from '../pivot'
import { tableWidget, textWidget } from '../widgets'

/** Waits for the data and for the exporters' code, which loads on its own. */
const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    await nextTick()
  }
}

const rows = [
  { region: '华东', city: '上海', amount: 1200, note: '=1+1' },
  { region: '华东', city: '杭州', amount: 800, note: '' },
  { region: '华南', city: '广州', amount: 600, note: '' },
]

/** Writes the workbook it gets as JSON, to look at what a widget gave. */
const json = defineSheetExporter({
  name: 'json',
  label: 'JSON',
  extension: 'json',
  mime: 'application/json',
  export: (source) => JSON.stringify(source.book),
})

/** A widget that gives no workbook. */
const plain = defineDashboardWidget({
  type: 'plain',
  label: '说明',
  component: defineComponent(() => () => h('p', '说明')),
})

/** A widget whose export fails. */
const broken = defineDashboardWidget({
  type: 'broken',
  label: '坏的',
  component: defineComponent(() => {
    useDashboardWidget().setWorkbook(() => {
      throw new Error('没有数据')
    })
    return () => h('p')
  }),
})

const place = (x: number, y = 0) => ({ lg: { x, y, w: 3, h: 3 } })

const list: DashboardDocument['widgets'] = [
  {
    id: 'table',
    type: 'table',
    title: '订单',
    props: {
      source: 'rows',
      columns: [{ key: 'city', title: '城市' }, { key: 'amount' }, { key: 'note' }],
    },
    place: place(0),
  },
  {
    id: 'chart',
    type: 'chart',
    title: '各区销售额',
    props: {
      source: 'rows',
      kind: 'bar',
      x: 'region',
      y: ['amount'],
      labels: { amount: '销售额' },
    },
    place: place(3),
  },
  {
    id: 'pivot',
    type: 'pivot',
    title: '透视',
    props: { source: 'rows', config: { rows: ['region'], values: ['amount'] } },
    place: place(6),
  },
  { id: 'plain', type: 'plain', place: place(9) },
  { id: 'broken', type: 'broken', place: place(0, 3) },
  { id: 'text', type: 'text', props: { text: '说明' }, place: place(3, 3) },
]

function setup(props: Record<string, unknown> = {}) {
  const dashboard = ref<DashboardExpose>()
  const errors: DashboardExportErrorEvent[] = []
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(DouDashboard, {
          ref: dashboard,
          modelValue: { version: 1, widgets: list },
          widgets: [tableWidget(), chartWidget(), pivotWidget(), textWidget(), plain, broken],
          sources: { rows: () => rows },
          exporters: [csvExporter, json],
          onExportError: (event: DashboardExportErrorEvent) => errors.push(event),
          ...props,
        }),
    }),
    { attachTo: document.body },
  )
  return { wrapper, errors, api: () => dashboard.value! }
}

const bookOf = async (blob: Blob) => JSON.parse(await blob.text()) as SheetWorkbook

afterEach(() => {
  document.body.innerHTML = ''
})

describe('exporting widgets', () => {
  it('writes a table widget as its rows, text that reads as a formula kept as text', async () => {
    const { wrapper, api } = setup()
    await flush()
    const csv = await api().exportWidget('table', 'csv', { options: { bom: false } })
    expect(csv.type).toBe('text/csv')
    expect(await csv.text()).toBe("城市,amount,note\r\n上海,1200,'=1+1\r\n杭州,800,\r\n广州,600,")
    const book = await bookOf(await api().exportWidget('table', json))
    expect(book.sheets[0]!.name).toBe('订单')
    expect(book.sheets[0]!.freeze).toEqual({ rows: 1, cols: 0 })
    expect(book.sheets[0]!.cells[0]![0]).toEqual({ value: '城市', style: 'head' })
    expect(book.styles).toEqual({ head: { bold: true } })
    wrapper.unmount()
  })

  it('writes a chart widget as its data and a pivot widget as its table', async () => {
    const { wrapper, api } = setup()
    await flush()
    const chart = await api().exportWidget('chart', 'csv', { options: { bom: false } })
    expect(await chart.text()).toBe('region,销售额\r\n华东,1200\r\n华东,800\r\n华南,600')
    const pivot = await bookOf(await api().exportWidget('pivot', json))
    expect(pivot.sheets[0]!.name).toBe('透视')
    const csv = await api().exportWidget('pivot', 'csv', { options: { bom: false } })
    expect(await csv.text()).toContain('华东,2000')
    wrapper.unmount()
  })

  it('refuses a widget without a workbook and an exporter it lacks', async () => {
    const { wrapper, api } = setup()
    await flush()
    await expect(api().exportWidget('plain', 'csv')).rejects.toThrow(/nothing to export/)
    await expect(api().exportWidget('nope', 'csv')).rejects.toThrow(/no widget "nope"/)
    await expect(api().exportWidget('table', 'xlsx')).rejects.toThrow(/no exporter "xlsx"/)
    wrapper.unmount()
  })

  it('lists the exporters in the title bar of widgets with a workbook, while viewing and editing', async () => {
    const { wrapper } = setup()
    await flush()
    const frame = (id: string) => wrapper.find(`[data-grid-id="${id}"]`)
    // viewing: a download button next to full screen
    expect(frame('table').find('button[aria-label="导出"]').exists()).toBe(true)
    expect(frame('plain').find('button[aria-label="导出"]').exists()).toBe(false)
    expect(frame('text').find('button[aria-label="导出"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('puts the exporters in a submenu of the widget menu while editing', async () => {
    const { wrapper } = setup({ editable: true })
    await flush()
    const frame = wrapper.find('[data-grid-id="table"]')
    expect(frame.find('button[aria-label="导出"]').exists()).toBe(false)
    await frame.find('button[aria-label="格子操作"]').trigger('click')
    await flush()
    const sub = document.querySelector<HTMLElement>('[role="menuitem"][aria-haspopup]')
    expect(sub?.textContent).toContain('导出')
    wrapper.unmount()
  })

  it('has no export menu without exporters', async () => {
    const { wrapper } = setup({ exporters: undefined })
    await flush()
    expect(wrapper.find('button[aria-label="导出"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('tells of a failed export from the menu in the widget, unless prevented', async () => {
    const { wrapper, errors } = setup()
    await flush()
    const frame = () => wrapper.find('[data-grid-id="broken"]')
    await frame().find('button[aria-label="导出"]').trigger('click')
    await flush()
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
      el.textContent?.includes('CSV'),
    )
    item!.click()
    await flush()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.widget).toBe('broken')
    expect(errors[0]!.exporter).toBe('csv')
    expect(errors[0]!.message).toBe('导出失败：没有数据')
    expect(frame().find('[role="alert"]').text()).toContain('导出失败：没有数据')
    await frame().find('[role="alert"] button').trigger('click')
    expect(frame().find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('leaves the telling to the app when it prevents the default', async () => {
    const { wrapper } = setup({
      onExportError: (event: DashboardExportErrorEvent) => event.preventDefault(),
    })
    await flush()
    const frame = () => wrapper.find('[data-grid-id="broken"]')
    await frame().find('button[aria-label="导出"]').trigger('click')
    await flush()
    ;[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((el) => el.textContent?.includes('CSV'))!
      .click()
    await flush()
    expect(frame().find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
