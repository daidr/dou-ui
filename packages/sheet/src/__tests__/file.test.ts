import { FileJsonIcon, FileTextIcon } from '@dou-ui/icons'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  createFileSource,
  csvExporter,
  csvImporter,
  defineSheetCellType,
  defineSheetExporter,
  defineSheetExtension,
  defineSheetImporter,
  DouSheet,
  DouSheetToolbar,
  exportWorkbook,
  isSheetError,
  readWorkbook,
  useSheet,
  type SheetContext,
  type SheetExpose,
  type SheetFileErrorEvent,
  type SheetTransaction,
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
    // an exporter picked at run time, of two with different options, goes in as it is
    const json = defineSheetExporter<{ indent?: number }>({
      name: 'json',
      label: 'JSON',
      extension: 'json',
      mime: 'application/json',
      export: (source, o) => JSON.stringify(source.sheets[0]!.data.cells, null, o?.indent),
    })
    const pick = (kind: string) => (kind === 'json' ? json : csvExporter)
    const either = await exportWorkbook(book(), pick('json'), { scope: 'sheet' })
    expect(either.type).toBe('application/json')
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

describe('file source', () => {
  it('gives errors as SheetError in result, as their code in plain', () => {
    const source = createFileSource({ sheets: [{ name: 'S', cells: [['=1/0', '=A1']] }] })
    expect(isSheetError(source.result(0, 0, 0))).toBe(true)
    expect(source.plain(0, 0, 0)).toBe('#DIV/0!')
    expect(source.result(0, 0, 1)).toBe(source.result(0, 0, 0))
  })

  it('gives styles in plain colors, with what conditional formats add', async () => {
    let seen: unknown[] = []
    const probe = defineSheetExporter({
      name: 'probe',
      label: 'probe',
      extension: 'txt',
      mime: 'text/plain',
      export(source) {
        seen = [source.style(0, 0, 0), source.style(0, 1, 0), source.style(0, 2, 0)]
        return ''
      },
    })
    await exportWorkbook(
      {
        styles: { h: { bold: true, tone: 'primary', fill: 'warning' } },
        sheets: [
          {
            name: '上海',
            cells: [[{ value: 1, style: 'h' }], [5], [1]],
            conditionalFormats: [
              {
                range: 'A2:A3',
                when: { op: 'gt', value: 3 },
                style: { fill: 'danger' },
              },
            ],
          },
        ],
      },
      probe,
    )
    expect(seen[0]).toEqual({
      bold: true,
      color: '#3f56b5',
      background: expect.stringMatching(/^#/),
    })
    expect((seen[1] as { background: string }).background).toMatch(/^#[0-9a-f]{6}$/)
    expect(seen[2]).toEqual({})
  })

  it('takes a sheet by name, and refuses exporters that draw the grid', async () => {
    const two: SheetWorkbook = {
      sheets: [
        { name: '预算', cells: [[1]] },
        { name: '门店', cells: [['上海']] },
      ],
    }
    const blob = await exportWorkbook(two, csvExporter, {
      sheet: '门店',
      options: { bom: false },
    })
    expect(await blob.text()).toBe('上海')
    await expect(exportWorkbook(two, csvExporter, { sheet: '无' })).rejects.toThrow(/no sheet/)
    const drawn = defineSheetExporter({
      ...csvExporter,
      name: 'drawn',
      needs: 'view',
    })
    await expect(exportWorkbook(two, drawn)).rejects.toThrow(/only works in DouSheet/)
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

function setup(
  props: Record<string, unknown> = {},
  toolbar?: Record<string, unknown>,
  start: SheetWorkbook = book(),
) {
  const doc = ref(structuredClone(start))
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
const jsonImporter = defineSheetImporter({
  name: 'json',
  label: 'JSON',
  accept: ['.json'],
  import: async (file) => ({
    book: JSON.parse(await file.text()) as SheetWorkbook,
  }),
})
const jsonExtension = defineSheetExtension({
  name: 'json',
  importers: [jsonImporter],
})
const json = (data: SheetWorkbook) => new File([JSON.stringify(data)], 'b.json')

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
    const jsonOut = defineSheetExporter({
      name: 'json',
      label: 'JSON',
      extension: 'json',
      mime: 'application/json',
      export: (source) => JSON.stringify(source.book),
    })
    const { wrapper, context } = setup({
      extensions: [defineSheetExtension({ name: 'json', exporters: [jsonOut] })],
    })
    expect(context().exporters.value.map((e) => e.name)).toEqual(['csv', 'png', 'svg', 'json'])
    // an exporter without an icon gets one for the file it writes
    const icons = Object.fromEntries(context().exporters.value.map((e) => [e.name, e.icon]))
    expect(icons.csv).toBe(FileTextIcon)
    expect(icons.json).toBe(FileJsonIcon)
    expect(context().importAccept.value).toContain('.csv')
    wrapper.unmount()
    const twice = [
      defineSheetExtension({ name: 'a', exporters: [jsonOut] }),
      defineSheetExtension({ name: 'b', exporters: [jsonOut] }),
    ]
    const clash = setup({ extensions: twice })
    expect(() => clash.context().exporters.value).toThrow(/added by both "a" and "b"/)
    clash.wrapper.unmount()
  })

  it('lists the exporters in the toolbar menu, with what to write when there is a choice', async () => {
    const { wrapper } = setup({}, { tools: ['export', 'import'] })
    await wrapper.find('.dou-sheet-toolbar [aria-label="导出"]').trigger('click')
    await nextTick()
    const labels = [...document.querySelectorAll('[role="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    )
    expect(labels).toEqual(['CSV 文件 (.csv)', '图片 (.png)', '矢量图 (.svg)'])
    // a range is selected: each can write the sheet or the selection
    expect(document.querySelectorAll('[aria-haspopup="menu"][role="menuitem"]').length).toBe(3)
    expect(wrapper.find('.dou-sheet-toolbar__picker').attributes('accept')).toContain('.csv')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('gives append imports new sheet names, and their formulas follow', async () => {
    const { wrapper, doc, sheet } = setup({ extensions: [jsonExtension] })
    await sheet().importFile(
      json({
        sheets: [
          { name: '预算', cells: [[5]] },
          { name: '汇总', cells: [['=预算!A1*2']] },
        ],
      }),
    )
    await nextTick()
    expect(doc.value.sheets.map((s) => s.name)).toEqual(['预算', '预算 (2)', '汇总'])
    expect(doc.value.sheets[2]!.cells[0]![0]).toBe("='预算 (2)'!A1*2")
    wrapper.unmount()
  })

  it('renames the sheets and styles the imported rules name, too', async () => {
    const { wrapper, doc, sheet } = setup({ extensions: [jsonExtension] }, undefined, {
      styles: { hl: { bold: true } },
      sheets: [{ name: '选项', cells: [['x']] }],
    })
    await sheet().importFile(
      json({
        styles: { hl: { italic: true } },
        sheets: [
          { name: '选项', cells: [['a'], ['b']] },
          {
            name: '录入',
            cells: [['a']],
            validations: [{ range: 'A1:A9', list: '=选项!A1:A2' }],
            conditionalFormats: [
              { range: 'A1:A9', formula: '=选项!A1="a"', style: 'hl' },
              { range: 'A1:A9', when: { op: 'eq', value: 'b' }, style: 'hl' },
            ],
          },
        ],
      }),
    )
    await nextTick()
    const added = doc.value.sheets[2]!
    expect(added.validations![0]).toMatchObject({ list: "='选项 (2)'!A1:A2" })
    expect(added.conditionalFormats![0]).toMatchObject({
      formula: '=\'选项 (2)\'!A1="a"',
      style: 'hl 2',
    })
    expect(added.conditionalFormats![1]).toMatchObject({ style: 'hl 2' })
    wrapper.unmount()
  })

  it('leaves the message to a file-error listener that asks', async () => {
    const said: string[] = []
    const { wrapper, sheet } = setup({
      onFileError: (event: SheetFileErrorEvent) => {
        said.push(event.message)
        event.preventDefault()
      },
    })
    expect(await sheet().importFile(new File(['x'], '表.xlsx'))).toBeNull()
    await nextTick()
    expect(said).toEqual(['不支持导入“表.xlsx”'])
    expect(wrapper.find('.dou-sheet__notice').exists()).toBe(false)
    wrapper.unmount()
  })

  it("brings cell types along: the file's for replace, renamed when they clash for append and insert", async () => {
    const host: SheetWorkbook = {
      types: { s: { type: 'select', options: ['host'] } },
      sheets: [{ name: 'A', cells: [[{ value: 'host', type: 's' }]] }],
    }
    const incoming: SheetWorkbook = {
      types: { s: { type: 'select', options: ['incoming'] } },
      sheets: [{ name: 'B', cells: [[{ value: 'incoming', type: 's' }]] }],
    }
    const replaced = setup({ extensions: [jsonExtension] }, undefined, host)
    await replaced.sheet().importFile(json(incoming), { mode: 'replace' })
    expect(replaced.doc.value.types).toEqual(incoming.types)
    replaced.wrapper.unmount()

    for (const mode of ['append', 'insert'] as const) {
      const { wrapper, doc, sheet } = setup({ extensions: [jsonExtension] }, undefined, host)
      await sheet().importFile(json(incoming), { mode })
      expect(doc.value.types).toEqual({
        s: host.types!.s,
        's 2': incoming.types!.s,
      })
      // insert goes in at the active cell, A2
      const at =
        mode === 'append' ? doc.value.sheets[1]!.cells[0]![0] : doc.value.sheets[0]!.cells[1]![0]
      expect(at).toEqual({ value: 'incoming', type: 's 2' })
      wrapper.unmount()
    }
  })

  it('swaps the styles for replace', async () => {
    const { wrapper, doc, sheet } = setup({ extensions: [jsonExtension] }, undefined, {
      styles: { h: { bold: true } },
      sheets: [{ name: 'A', cells: [[{ value: 1, style: 'h' }]] }],
    })
    await sheet().importFile(
      json({
        styles: { h: { italic: true } },
        sheets: [{ name: 'B', cells: [[{ value: 2, style: 'h' }]] }],
      }),
      { mode: 'replace' },
    )
    expect(doc.value.styles).toEqual({ h: { italic: true } })
    expect(doc.value.sheets[0]!.cells).toEqual([[{ value: 2, style: 'h' }]])
    sheet().undo()
    await nextTick()
    expect(doc.value.styles).toEqual({ h: { bold: true } })
    wrapper.unmount()
  })

  it('inserts once from the active cell, whatever is selected, as an import', async () => {
    const trs: SheetTransaction[] = []
    const { wrapper, doc, sheet } = setup({
      onTransaction: (tr: SheetTransaction) => trs.push(tr),
    })
    // A2:B3 is selected
    await sheet().importFile(csv('z'), { mode: 'insert' })
    await nextTick()
    expect(doc.value.sheets[0]!.cells[1]!.slice(0, 2)).toEqual([
      'z',
      { value: 1280, format: '¥#,##0.00' },
    ])
    expect(doc.value.sheets[0]!.cells[2]![0]).toBe('餐饮')
    expect(trs.map((tr) => tr.meta.action)).toEqual(['import'])
    wrapper.unmount()
  })

  it('tells of failures over the grid and with file-error', async () => {
    const errors: SheetFileErrorEvent[] = []
    const bad = defineSheetImporter({
      name: 'bad',
      label: 'bad',
      accept: ['.bad'],
      import: () => {
        throw new Error('boom')
      },
    })
    const { wrapper, sheet } = setup({
      extensions: [defineSheetExtension({ name: 'bad', importers: [bad] })],
      onFileError: (event: SheetFileErrorEvent) => errors.push(event),
    })
    expect(await sheet().importFile(new File(['x'], '表.xlsx'))).toBeNull()
    await nextTick()
    expect(wrapper.text()).toContain('不支持导入“表.xlsx”')
    await expect(sheet().importFile(new File(['x'], 'a.bad'))).rejects.toThrow('boom')
    await expect(sheet().saveFile('csv', { scope: 'workbook' })).rejects.toThrow(/workbook/)
    expect(errors.map((e) => [e.action, e.importer ?? e.exporter ?? null])).toEqual([
      ['import', null],
      ['import', 'bad'],
      ['export', 'csv'],
    ])
    wrapper.unmount()
  })

  it('writes a stopped import later with apply()', async () => {
    let later!: () => boolean
    const { wrapper, doc, sheet } = setup({
      onImport: (event: SheetImportEvent) => {
        event.preventDefault()
        later = event.apply
      },
    })
    expect(await sheet().importFile(csv('a'))).toBeNull()
    expect(doc.value.sheets.length).toBe(1)
    expect(later()).toBe(true)
    await nextTick()
    expect(doc.value.sheets.length).toBe(2)
    // only once
    expect(later()).toBe(false)
    wrapper.unmount()
  })

  it('writes nothing once aborted, and gives the importer the signal', async () => {
    let signal: AbortSignal | undefined
    let finish!: () => void
    const slow = defineSheetImporter({
      name: 'slow',
      label: 'slow',
      accept: ['.slow'],
      import: (_file, context) => {
        signal = context.signal
        return new Promise((resolve) => {
          finish = () => resolve({ book: { sheets: [{ name: 'x', cells: [[1]] }] } })
        })
      },
    })
    const { wrapper, doc, sheet } = setup({
      extensions: [defineSheetExtension({ name: 'slow', importers: [slow] })],
    })
    const controller = new AbortController()
    const pending = sheet().importFile(new File(['x'], 'a.slow'), {
      signal: controller.signal,
    })
    await new Promise((resolve) => setTimeout(resolve))
    expect(signal?.aborted).toBe(false)
    controller.abort()
    expect(signal?.aborted).toBe(true)
    finish()
    expect(await pending).toBeNull()
    expect(doc.value.sheets.length).toBe(1)
    wrapper.unmount()
  })

  it("gives labels in the sheet's language to menus of one's own", () => {
    const { wrapper, context } = setup()
    expect(context().exporters.value[0]).toMatchObject({
      name: 'csv',
      label: 'CSV 文件 (.csv)',
      scopes: ['sheet', 'selection'],
    })
    expect(context().importers.value[0]).toMatchObject({
      name: 'csv',
      accept: expect.any(Array),
    })
    wrapper.unmount()
  })
})
