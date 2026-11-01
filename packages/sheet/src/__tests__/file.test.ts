import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  csvExporter,
  csvImporter,
  defineSheetCellType,
  defineSheetExporter,
  defineSheetExtension,
  defineSheetImporter,
  DouSheet,
  DouSheetToolbar,
  exportWorkbook,
  readWorkbook,
  useSheet,
  type SheetContext,
  type SheetExpose,
  type SheetImportEvent,
  type SheetSelection,
  type SheetWorkbook,
} from '../index'

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '预算',
      cells: [
        ['项目', '金额', '完成'],
        ['场地', { value: 1280, format: '¥#,##0.00' }, { value: 0.5, type: 'stars' }],
        ['餐饮', 640.5, true],
        ['合计', '=B2+B3'],
      ],
    },
  ],
})

/** Shows a number of stars, and writes the number into files. */
const stars = defineSheetCellType({
  name: 'stars',
  format: (value) => '★'.repeat(Math.round(Number(value) * 4)),
  plain: (value) => Math.round(Number(value) * 4),
})
const starsExtension = defineSheetExtension({ name: 'stars', cellTypes: [stars] })

describe('exportWorkbook', () => {
  it('writes CSV without a grid, with formulas worked out and cell types as they show', async () => {
    const blob = await exportWorkbook(book(), csvExporter, {
      extensions: [starsExtension],
      options: { bom: false },
    })
    expect(blob.type).toBe('text/csv')
    expect(await blob.text()).toBe(
      '项目,金额,完成\r\n场地,"¥1,280.00",★★\r\n餐饮,640.5,TRUE\r\n合计,1920.5,',
    )
  })

  it('writes only the cells asked for, and refuses a scope the exporter lacks', async () => {
    const blob = await exportWorkbook(book(), csvExporter, {
      scope: 'selection',
      range: 'A2:A3',
      options: { bom: false },
    })
    expect(await blob.text()).toBe('场地\r\n餐饮')
    await expect(exportWorkbook(book(), csvExporter, { scope: 'workbook' })).rejects.toThrow(
      /can't export a workbook/,
    )
  })

  it('gives exporters plain values and what the cells come to', async () => {
    let seen: unknown[] = []
    const probe = defineSheetExporter({
      name: 'probe',
      label: 'probe',
      extension: 'txt',
      mime: 'text/plain',
      export(source) {
        seen = [
          source.plain(0, 1, 2),
          source.result(0, 3, 1),
          source.value(0, 3, 1),
          source.text(0, 1, 1),
          source.format(0, 1, 1),
          source.sheets.map((s) => s.bounds),
        ]
        return 'ok'
      },
    })
    const blob = await exportWorkbook(book(), probe, { extensions: [starsExtension] })
    expect(await blob.text()).toBe('ok')
    expect(seen).toEqual([
      2,
      1920.5,
      '=B2+B3',
      '¥1,280.00',
      '¥#,##0.00',
      [{ top: 0, left: 0, bottom: 3, right: 2 }],
    ])
  })
})

describe('readWorkbook', () => {
  it('reads CSV into a sheet named after the file', async () => {
    const file = new File(['名称,数量\n苹果,3'], '水果.csv', { type: 'text/csv' })
    const { book: read } = await readWorkbook(file, csvImporter)
    expect(read.sheets[0]!.name).toBe('水果')
    expect(read.sheets[0]!.cells).toEqual([
      ['名称', '数量'],
      ['苹果', 3],
    ])
  })
})

function setup(props: Record<string, unknown> = {}, toolbar?: Record<string, unknown>) {
  const doc = ref(book())
  const selection = ref<SheetSelection>({
    active: { row: 1, col: 0 },
    ranges: [{ start: { row: 1, col: 0 }, end: { row: 2, col: 1 } }],
  })
  let context!: SheetContext
  const Probe = defineComponent(() => {
    context = useSheet()
    return () => null
  })
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
            selection: selection.value,
            'onUpdate:selection': (value: SheetSelection) => (selection.value = value),
            ...props,
          },
          { header: () => [toolbar && h(DouSheetToolbar, toolbar), h(Probe)] },
        ),
    ),
    { attachTo: document.body },
  )
  const sheet = () => wrapper.findComponent(DouSheet).vm as unknown as SheetExpose
  return { wrapper, doc, sheet, context: () => context }
}

const csv = (text: string, name = '水果.csv') => new File([text], name, { type: 'text/csv' })

describe('DouSheet files', () => {
  it('exports the selection or a sheet by name', async () => {
    const { wrapper, sheet } = setup()
    const selected = await sheet().exportFile('csv', {
      scope: 'selection',
      options: { bom: false },
    })
    expect(await selected.text()).toBe('场地,"¥1,280.00"\r\n餐饮,640.5')
    await expect(sheet().exportFile('nope')).rejects.toThrow(/no exporter "nope"/)
    wrapper.unmount()
  })

  it('appends an imported file as a new sheet, undone in one step', async () => {
    const { wrapper, doc, sheet } = setup()
    const read = await sheet().importFile(csv('名称,数量\n苹果,3'))
    await nextTick()
    expect(read?.book.sheets[0]!.name).toBe('水果')
    expect(doc.value.sheets.map((s) => s.name)).toEqual(['预算', '水果'])
    // the same file again gets a name of its own
    await sheet().importFile(csv('a'))
    await nextTick()
    expect(doc.value.sheets.map((s) => s.name)).toEqual(['预算', '水果', '水果 (2)'])
    sheet().undo()
    sheet().undo()
    await nextTick()
    expect(doc.value.sheets.map((s) => s.name)).toEqual(['预算'])
    wrapper.unmount()
  })

  it('replaces every sheet, keeping formulas that name the new sheets', async () => {
    const { wrapper, doc, sheet } = setup()
    const importer = defineSheetImporter({
      name: 'json',
      label: 'JSON',
      accept: ['.json'],
      import: async (file) => ({ book: JSON.parse(await file.text()) as SheetWorkbook }),
    })
    const replacement: SheetWorkbook = {
      sheets: [
        { name: '预算', cells: [[1, 2]] },
        { name: '汇总', cells: [['=预算!A1+预算!B1']] },
      ],
    }
    const file = new File([JSON.stringify(replacement)], 'b.json')
    await sheet().importFile(file, { mode: 'replace', importer: undefined })
    // no importer takes .json yet: nothing changes
    expect(doc.value.sheets.length).toBe(1)
    wrapper.unmount()

    const next = setup({
      extensions: [defineSheetExtension({ name: 'json', importers: [importer] })],
    })
    await next.sheet().importFile(file, { mode: 'replace' })
    await nextTick()
    expect(next.doc.value.sheets.map((s) => s.name)).toEqual(['预算', '汇总'])
    expect(next.doc.value.sheets[1]!.cells[0]![0]).toBe('=预算!A1+预算!B1')
    expect(next.doc.value.sheets[0]!.cells).toEqual([[1, 2]])
    next.sheet().undo()
    await nextTick()
    expect(next.doc.value.sheets.map((s) => s.name)).toEqual(['预算'])
    expect(next.doc.value.sheets[0]!.cells[0]![0]).toBe('项目')
    next.wrapper.unmount()
  })

  it('pastes the first sheet at the active cell with insert', async () => {
    const { wrapper, doc, sheet } = setup()
    await sheet().importFile(csv('x,y'), { mode: 'insert' })
    await nextTick()
    expect(doc.value.sheets[0]!.cells[1]!.slice(0, 2)).toEqual(['x', 'y'])
    wrapper.unmount()
  })

  it('lets the import event change or stop the import, and refuses in a read-only grid', async () => {
    const events: SheetImportEvent[] = []
    const { wrapper, doc, sheet } = setup({
      onImport: (event: SheetImportEvent) => {
        events.push(event)
        event.preventDefault()
      },
    })
    expect(await sheet().importFile(csv('a'))).toBeNull()
    expect(events[0]).toMatchObject({ importer: 'csv', mode: 'append' })
    expect(doc.value.sheets.length).toBe(1)
    wrapper.unmount()
    const locked = setup({ readonly: true })
    expect(await locked.sheet().importFile(csv('a'))).toBeNull()
    locked.wrapper.unmount()
  })

  it('takes exporters and importers from extensions', () => {
    const json = defineSheetExporter({
      name: 'json',
      label: 'JSON',
      extension: 'json',
      mime: 'application/json',
      export: (source) => JSON.stringify(source.book),
    })
    const { wrapper, context } = setup({
      extensions: [defineSheetExtension({ name: 'json', exporters: [json] })],
    })
    expect(context().exporters.value.map((e) => e.name)).toEqual(['csv', 'png', 'svg', 'json'])
    expect(context().importAccept.value).toContain('.csv')
    wrapper.unmount()
    const twice = [
      defineSheetExtension({ name: 'a', exporters: [json] }),
      defineSheetExtension({ name: 'b', exporters: [json] }),
    ]
    const clash = setup({ extensions: twice })
    expect(() => clash.context().exporters.value).toThrow(/added by both "a" and "b"/)
    clash.wrapper.unmount()
  })

  it('lists the exporters in the toolbar menu', async () => {
    const { wrapper } = setup({}, { tools: ['export', 'import'] })
    await wrapper.find('.dou-sheet-toolbar [aria-label="导出"]').trigger('click')
    await nextTick()
    const labels = [...document.querySelectorAll('[role="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    )
    expect(labels).toEqual(['CSV 文件 (.csv)', '图片 (.png)', '矢量图 (.svg)'])
    expect(wrapper.find('.dou-sheet-toolbar__picker').attributes('accept')).toContain('.csv')
    wrapper.unmount()
  })
})
