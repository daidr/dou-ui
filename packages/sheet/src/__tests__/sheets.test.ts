import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  detectDelimiter,
  DouSheet,
  DouSheetTabs,
  formatRange,
  parseCSV,
  readCSV,
  quoteSheet,
  renameReferences,
  SheetTransaction,
  sheetToCSV,
  type SheetData,
  type SheetSelection,
  type SheetWorkbook,
} from '../index'
import type { SheetExpose } from '../types'

const book = (): SheetWorkbook => ({
  sheets: [
    { name: '九月', cells: [['静安', 10]] },
    { name: '十月', cells: [['静安', 12]] },
    {
      name: '汇总',
      cells: [['=九月!B1+十月!B1', '=SUM(B1)']],
    },
  ],
})

const names = (doc: SheetWorkbook) => doc.sheets.map((sheet) => sheet.name)

describe('sheets in a transaction', () => {
  it('adds sheets with free names, and refuses taken ones', () => {
    const tr = new SheetTransaction(book()).addSheet().addSheet({ name: '十一月' }, 2)
    expect(names(tr.doc)).toEqual(['九月', '十月', '十一月', '汇总', 'Sheet4'])
    expect(() => tr.addSheet({ name: '九月' })).toThrow(RangeError)
    expect(() => tr.addSheet({ name: ' ' })).toThrow(RangeError)
    // undoing takes them out again
    expect(
      names(new SheetTransaction(tr.doc).step(tr.inverse[0]!).step(tr.inverse[1]!).doc),
    ).toEqual(names(book()))
  })

  it('removes a sheet, and formulas pointing at it lose it', () => {
    const before = book()
    const tr = new SheetTransaction(before).removeSheet('九月')
    expect(names(tr.doc)).toEqual(['十月', '汇总'])
    expect(tr.doc.sheets[1]!.cells[0]![0]).toBe('=#REF!+十月!B1')
    const back = new SheetTransaction(tr.doc)
    for (const step of tr.inverse) back.step(step)
    expect(back.doc).toEqual(before)
    // the last sheet stays
    const one = new SheetTransaction({ sheets: [{ name: 'a', cells: [] }] }).removeSheet(0)
    expect(one.changed).toBe(false)
  })

  it('moves a sheet and back', () => {
    const tr = new SheetTransaction(book()).moveSheet('汇总', 0)
    expect(names(tr.doc)).toEqual(['汇总', '九月', '十月'])
    expect(new SheetTransaction(tr.doc).moveSheet(0, 0).changed).toBe(false)
    const back = new SheetTransaction(tr.doc).step(tr.inverse[0]!)
    expect(names(back.doc)).toEqual(names(book()))
  })

  it('renames a sheet, and formulas naming it follow', () => {
    const tr = new SheetTransaction(book()).renameSheet('九月', '九月 上海')
    expect(names(tr.doc)).toEqual(['九月 上海', '十月', '汇总'])
    expect(tr.doc.sheets[2]!.cells[0]![0]).toBe("='九月 上海'!B1+十月!B1")
    expect(() => new SheetTransaction(book()).renameSheet(0, '十月')).toThrow(RangeError)
    const back = new SheetTransaction(tr.doc)
    for (const step of tr.inverse) back.step(step)
    expect(back.doc).toEqual(book())
  })

  it('gives a free name', () => {
    const tr = new SheetTransaction(book())
    expect(tr.uniqueName('门店')).toBe('门店')
    expect(tr.uniqueName('九月')).toBe('九月 (2)')
    tr.addSheet({ name: '九月 (2)' })
    expect(tr.uniqueName('九月')).toBe('九月 (3)')
  })

  it('rewrites only references naming the sheet', () => {
    expect(renameReferences('=A1+表1!A1+"表1!A1"+表10!A1', '表1', '数据')).toBe(
      '=A1+数据!A1+"表1!A1"+表10!A1',
    )
  })

  it('quotes sheet names that read as a cell', () => {
    expect(['AB12', 'R1C1', 'r2', 'C', '数据', 'Q1'].map(quoteSheet)).toEqual([
      "'AB12'",
      "'R1C1'",
      "'r2'",
      "'C'",
      '数据',
      "'Q1'",
    ])
    expect(renameReferences('=表1!A1', '表1', 'R1C1')).toBe("='R1C1'!A1")
  })

  it('duplicates a sheet, and the copy changes on its own', () => {
    const tr = new SheetTransaction(book())
    tr.setValue({ sheet: 0, row: 0, col: 1 }, 11)
    tr.duplicateSheet('九月').duplicateSheet('九月')
    expect(names(tr.doc)).toEqual(['九月', '九月 (3)', '九月 (2)', '十月', '汇总'])
    tr.setValue({ sheet: 0, row: 0, col: 1 }, 99)
    expect(tr.doc.sheets[2]!.cells[0]![1]).toBe(11)
    expect(tr.doc.sheets[0]!.cells[0]![1]).toBe(99)
  })

  it('keeps steps on the right sheet after sheets move', () => {
    const tr = new SheetTransaction(book())
    tr.setValue({ sheet: '十月', row: 0, col: 1 }, 20)
    tr.moveSheet('十月', 0)
    tr.setValue({ sheet: '十月', row: 1, col: 0 }, '徐汇')
    expect(tr.doc.sheets[0]!.cells).toEqual([['静安', 20], ['徐汇']])
    expect(book().sheets[1]!.cells).toEqual([['静安', 12]])
  })
})

describe('CSV', () => {
  it('finds the delimiter', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('a;b;c\n"1,5";2;3')).toBe(';')
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
    expect(detectDelimiter('one field')).toBe(',')
  })

  it('reads quoted fields, line breaks and a byte order mark', () => {
    expect(parseCSV('\ufeff名称,备注\r\n"上海, 静安","说""好""\n的"\r\n,""\n')).toEqual([
      ['名称', '备注'],
      ['上海, 静安', '说"好"\n的'],
      ['', ''],
    ])
  })

  it('reads numbers and dates as typed, and codes as text', () => {
    expect(readCSV('数量,日期,编号,比例,卡号\n1,280,2026/3/5,007,12%,6222020200112233445')).toEqual(
      [
        ['数量', '日期', '编号', '比例', '卡号'],
        [
          1,
          280,
          { value: '2026-03-05', format: 'yyyy/m/d' },
          '007',
          { value: 0.12, format: '0%' },
          '6222020200112233445',
        ],
      ],
    )
    expect(readCSV('a,b\n1,TRUE', { typed: false })).toEqual([
      ['a', 'b'],
      ['1', 'TRUE'],
    ])
  })

  it('writes what the cells show, quoting where needed', () => {
    const sheet: SheetData = {
      name: '表',
      cells: [
        ['名称', '金额'],
        ['上海, 静安', { value: 1280, format: '¥#,##0.00' }],
        ['说"好"', true],
        null,
        [undefined, undefined, '=A1'],
      ],
    }
    // values by default, with a byte order mark
    expect(sheetToCSV(sheet)).toBe(
      '﻿名称,金额,\r\n"上海, 静安",1280,\r\n"说""好""",TRUE,\r\n,,\r\n,,\'=A1',
    )
    expect(sheetToCSV(sheet, { text: true, range: 'A2:B2', newline: '\n', bom: false })).toBe(
      '"上海, 静安","¥1,280.00"',
    )
    expect(sheetToCSV(sheet, { delimiter: ';', range: 'B:C', text: true })).toBe(
      "﻿金额;\r\n¥1,280.00;\r\nTRUE;\r\n;\r\n;'=A1",
    )
    expect(sheetToCSV({ name: '空', cells: [] })).toBe('﻿')
    expect(sheetToCSV({ name: '空', cells: [] }, { bom: false })).toBe('')
  })

  it('keeps text that a spreadsheet program would run as a formula from running', () => {
    const sheet: SheetData = {
      name: '表',
      cells: [['=HYPERLINK("x")', '+1', '-2+3', '@SUM(A1)', -2, "'=abc", '静安']],
    }
    expect(sheetToCSV(sheet, { bom: false })).toBe(
      `"'=HYPERLINK(""x"")",'+1,'-2+3,'@SUM(A1),-2,'=abc,静安`,
    )
    expect(sheetToCSV(sheet, { escapeFormulas: false, bom: false })).toBe(
      '"=HYPERLINK(""x"")",+1,-2+3,@SUM(A1),-2,=abc,静安',
    )
  })

  it('writes formulas as stored and reads them back', () => {
    const sheet: SheetData = { name: '表', cells: [[{ value: '=1+2' }, '+1', "'=abc"]] }
    const text = sheetToCSV(sheet, { formulas: true, bom: false })
    expect(text).toBe("=1+2,'+1,'=abc")
    expect(readCSV(text, { formulas: true })).toEqual([['=1+2', "'+1", "'=abc"]])
  })

  it('keeps what cellValue and cellText give from running as a formula, and asks neither for written formulas', () => {
    const sheet: SheetData = { name: '表', cells: [[5, 'a', '=1+2']] }
    const asked: unknown[] = []
    const cellValue = (_input: unknown, value: unknown) => (asked.push(value), '=cmd')
    expect(sheetToCSV(sheet, { cellValue, bom: false })).toBe("'=cmd,'=cmd,'=cmd")
    asked.length = 0
    expect(sheetToCSV(sheet, { cellValue, formulas: true, bom: false })).toBe("'=cmd,'=cmd,=1+2")
    expect(asked).toEqual([5, 'a'])
    expect(sheetToCSV(sheet, { text: true, cellText: () => '@x', bom: false })).toBe("@x,'@x,'@x")
  })

  it('reads = as text unless asked for formulas', () => {
    expect(readCSV('=1+1,=')).toEqual([["'=1+1", '=']])
    expect(readCSV('=1+1', { typed: false })).toEqual([["'=1+1"]])
    expect(readCSV('=1+1', { formulas: true })).toEqual([['=1+1']])
  })

  it('reads a decimal comma in files split by semicolons', () => {
    expect(readCSV('a;b;c;d\n1,5;1.280,5;12,5%;上海')).toEqual([
      ['a', 'b', 'c', 'd'],
      [1.5, 1280.5, { value: 0.125, format: '0.0%' }, '上海'],
    ])
    expect(readCSV('a,b\n"1,5",2', { decimal: ',' })).toEqual([
      ['a', 'b'],
      [1.5, 2],
    ])
    expect(readCSV('a;b\n1,5;2', { decimal: '.' })).toEqual([
      ['a', 'b'],
      ['1,5', 2],
    ])
  })
})

function setup(withTabs = true) {
  const doc = ref(book())
  const active = ref(0)
  const selection = ref<SheetSelection | undefined>()
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            ref: grid,
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
            activeSheet: active.value,
            'onUpdate:activeSheet': (value: number) => (active.value = value),
            selection: selection.value,
            'onUpdate:selection': (value: SheetSelection) => (selection.value = value),
          },
          withTabs ? { footer: () => h(DouSheetTabs) } : {},
        ),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  const key = async (name: string, init: KeyboardEventInit = {}, el: Element = input) => {
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  const tabs = () => wrapper.findAll('[role="tab"]')
  return { wrapper, doc, active, selection, grid, key, tabs }
}

describe('DouSheetTabs', () => {
  it('shows a tab for each sheet and switches sheets', async () => {
    const { wrapper, active, tabs } = setup()
    expect(tabs().map((tab) => tab.text())).toEqual(['九月', '十月', '汇总'])
    expect(tabs()[0]!.attributes('aria-selected')).toBe('true')
    await tabs()[1]!.trigger('click')
    expect(active.value).toBe(1)
    expect(wrapper.find('.dou-sheet__cell').text()).toBe('静安')
    expect(tabs()[1]!.attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('moves between tabs with the arrow keys', async () => {
    const { wrapper, active, tabs, key } = setup()
    await key('ArrowLeft', {}, tabs()[0]!.element)
    expect(active.value).toBe(2)
    await key('Home', {}, tabs()[2]!.element)
    expect(active.value).toBe(0)
    wrapper.unmount()
  })

  it('adds a sheet after the one shown, and undo takes it out', async () => {
    const { wrapper, doc, active, tabs, grid } = setup()
    await wrapper.find('.dou-sheet-tabs__add').trigger('click')
    expect(names(doc.value)).toEqual(['九月', '工作表4', '十月', '汇总'])
    expect(active.value).toBe(1)
    expect(tabs()).toHaveLength(4)
    grid.value!.undo()
    await nextTick()
    expect(names(doc.value)).toEqual(['九月', '十月', '汇总'])
    expect(active.value).toBe(0)
    wrapper.unmount()
  })

  it('renames with a double click, refusing a taken name', async () => {
    const { wrapper, doc, tabs } = setup()
    await tabs()[0]!.trigger('dblclick')
    await nextTick()
    const field = wrapper.find('.dou-sheet-tabs__input')
    await field.setValue('十月')
    await field.trigger('keydown', { key: 'Enter' })
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[role="alert"]').text()).toBe('已有名为“十月”的工作表')
    await field.setValue('九月份')
    await field.trigger('keydown', { key: 'Enter' })
    expect(names(doc.value)[0]).toBe('九月份')
    expect(doc.value.sheets[2]!.cells[0]![0]).toBe('=九月份!B1+十月!B1')
    wrapper.unmount()
  })

  it('keeps showing the same sheet when sheets move, and a neighbour when it goes', async () => {
    const { wrapper, active, grid } = setup(false)
    grid.value!.showSheet('十月')
    await nextTick()
    expect(active.value).toBe(1)
    grid.value!.transact((tr) => tr.moveSheet('十月', 2))
    await nextTick()
    expect(active.value).toBe(2)
    grid.value!.transact((tr) => tr.removeSheet('十月'))
    await nextTick()
    expect(active.value).toBe(1)
    expect(grid.value!.showSheet('没有')).toBe(false)
    wrapper.unmount()
  })

  it('remembers where each sheet was left', async () => {
    const { wrapper, selection, grid, key } = setup(false)
    grid.value!.select('B1')
    await nextTick()
    await key('PageDown', { ctrlKey: true })
    expect(formatRange(selection.value!.ranges[0]!)).toBe('A1')
    grid.value!.select('A1:B1')
    await key('PageUp', { ctrlKey: true })
    expect(formatRange(selection.value!.ranges[0]!)).toBe('B1')
    await key('PageDown', { ctrlKey: true })
    expect(formatRange(selection.value!.ranges[0]!)).toBe('A1:B1')
    wrapper.unmount()
  })

  it('undoes on the sheet the change was made on', async () => {
    const { wrapper, doc, active, grid } = setup(false)
    grid.value!.transact((tr) => tr.setValue('A1', '徐汇'))
    grid.value!.showSheet(2)
    await nextTick()
    grid.value!.transact((tr) => tr.moveSheet('汇总', 0))
    await nextTick()
    grid.value!.undo()
    grid.value!.undo()
    await nextTick()
    expect(active.value).toBe(0)
    expect(doc.value.sheets[0]!.cells[0]![0]).toBe('静安')
    wrapper.unmount()
  })

  it('writes the sheet shown as CSV', () => {
    const { wrapper, grid } = setup(false)
    expect(grid.value!.toCSV({ sheet: '十月', bom: false })).toBe('静安,12')
    wrapper.unmount()
  })
})
