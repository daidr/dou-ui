import { describe, expect, it } from 'vitest'
import {
  columnIndex,
  columnName,
  formatRange,
  parseCell,
  parseRange,
  splitSheet,
} from '../core/address'
import { SheetAxis } from '../core/axis'
import { formatValue, inputText, parseInput } from '../core/format'
import { SheetHistory } from '../core/history'
import { compactCell, colCountOf, rowCountOf, type SheetWorkbook } from '../core/model'
import { movePoint } from '../core/nav'
import { selectCell } from '../core/selection'
import { applySheetSteps, compactSheetSteps, SheetTransaction } from '../core/transaction'

describe('addresses', () => {
  it('names columns', () => {
    expect([0, 25, 26, 51, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA'])
    expect(['A', 'z', 'AA', 'ZZ', 'AAA'].map(columnIndex)).toEqual([0, 25, 26, 701, 702])
    expect(columnIndex('A1')).toBe(-1)
  })

  it('reads and writes cells and ranges', () => {
    expect(parseCell('B3')).toEqual({ row: 2, col: 1 })
    expect(parseCell('$C$10')).toEqual({ row: 9, col: 2 })
    expect(parseCell('A0')).toBeNull()
    expect(parseRange('C4:A1')).toEqual({ start: { row: 3, col: 2 }, end: { row: 0, col: 0 } })
    expect(formatRange(parseRange('C4:A1')!)).toBe('A1:C4')
    expect(formatRange(parseRange('B2')!)).toBe('B2')
    expect(parseRange('A1:B2:C3')).toBeNull()
  })

  it.each([
    ['B2', { start: { row: 1, col: 1 }, end: { row: 1, col: 1 } }],
    ['$A$1:b3', { start: { row: 0, col: 0 }, end: { row: 2, col: 1 } }],
    ['B:D', { start: { row: 0, col: 1 }, end: { row: Infinity, col: 3 } }],
    ['$C:$C', { start: { row: 0, col: 2 }, end: { row: Infinity, col: 2 } }],
    ['2:3', { start: { row: 1, col: 0 }, end: { row: 2, col: Infinity } }],
    ['A', null],
    ['B:3', null],
    ['0:2', null],
    ['', null],
  ])('parses the range %j', (text, range) => {
    expect(parseRange(text)).toEqual(range)
  })

  it.each([
    ['B2', 'B2'],
    ['C4:A1', 'A1:C4'],
    ['B:D', 'B:D'],
    ['B1:D1000', 'B:D'],
    ['A2:Z3', '2:3'],
    ['2:3', '2:3'],
    ['A1:Z1000', 'A1:Z1000'],
  ])('names %s as %s in a 1000 × 26 sheet', (text, name) => {
    expect(formatRange(parseRange(text)!, { rows: 1000, cols: 26 })).toBe(name)
  })

  it('splits off the sheet', () => {
    expect(splitSheet("'表 2'!A5")).toEqual({ sheet: '表 2', ref: 'A5' })
    expect(splitSheet("'戴兜''s'!B:B")).toEqual({ sheet: "戴兜's", ref: 'B:B' })
    expect(splitSheet('表2!A5')).toEqual({ sheet: '表2', ref: 'A5' })
    expect(splitSheet('A5')).toEqual({ ref: 'A5' })
  })
})

describe('axis', () => {
  it('finds offsets and indexes with some sizes changed', () => {
    const axis = new SheetAxis(10, 20, { 2: 40, 3: 0 })
    expect(axis.total).toBe(200)
    expect(axis.offset(3)).toBe(80)
    expect(axis.offset(4)).toBe(80)
    expect(axis.indexAt(0)).toBe(0)
    expect(axis.indexAt(79)).toBe(2)
    expect(axis.indexAt(80)).toBe(4)
    expect(axis.indexAt(10_000)).toBe(9)
    expect(axis.hidden(3)).toBe(true)
  })
})

describe('format', () => {
  it.each([
    [1234.5, '#,##0.00', '1,234.50'],
    [-1234.5, '#,##0', '-1,235'],
    [0.256, '0.0%', '25.6%'],
    [1.005, '0.00', '1.01'],
    [1.5, '0.##', '1.5'],
    [2, '0.##', '2'],
    [7, '000', '007'],
    [3, '¥#,##0.00', '¥3.00'],
    [-3, '¥#,##0.00', '-¥3.00'],
    [3, '0"件"', '3件'],
    [3, '0\\h', '3h'],
    [-3, '0;(0)', '(3)'],
    [3, '0;(0)', '3'],
    [0, '0;(0);"-"', '-'],
    [0, '0.00;(0.00);"零"', '零'],
    [0, '0.00;(0.00);0', '0'],
    [-2, '0;(0);"-"', '(2)'],
    [5, '0;(0);"-"', '5'],
    [-0.001, '0.00', '0.00'],
    [0.1 + 0.2, undefined, '0.3'],
    [1e21, undefined, '1E+21'],
    [3, 'yyyy', '3'],
    [true, undefined, 'TRUE'],
    [42, '@', '42'],
  ] as const)('shows %j with %j as %j', (value, format, text) => {
    expect(formatValue(value, format)).toBe(text)
  })

  it.each([
    ['2026-03-05', 'yyyy/m/d', '2026/3/5'],
    ['2026-03-05', 'yy-mm-dd', '26-03-05'],
    ['2026-03-05 09:07', 'mm-dd hh:mm', '03-05 09:07'],
    ['2026-03-05 09:07:08', 'h:mm:ss', '9:07:08'],
    ['2026-03-05 09:07', 'm/d h:mm', '3/5 9:07'],
    ['2026-03-05', 'yyyy"年"m"月"d"日"', '2026年3月5日'],
    ['2026-03-05', 'yyyy年m月d日', '2026年3月5日'],
    ['2026-03-05', 'yyyy-mm-dd "(d)"', '2026-03-05 (d)'],
    ['2026-03-05', 'd \\d', '5 d'],
    ['2026-03-05 18:30', 'yyyy-mm-dd at hh:mm', '2026-03-05 at 18:30'],
    ['09:05', 'h:mm', '9:05'],
    ['09:05:30', 'hh:mm:ss', '09:05:30'],
    ['09:05', 'yyyy-mm-dd', '09:05'],
    ['不是日期', 'yyyy', '不是日期'],
  ])('shows %j with %j as %j', (value, format, text) => {
    expect(formatValue(value, format)).toBe(text)
  })

  it('names weekdays in the given language', () => {
    expect(formatValue('2026-10-31', 'ddd', 'en')).toBe('Sat')
    expect(formatValue('2026-10-31', 'dddd', 'en')).toBe('Saturday')
    expect(formatValue('2026-10-31', 'm/d ddd', 'zh-CN')).toBe('10/31 周六')
    expect(formatValue('2026-10-31', 'dddd', 'zh-CN')).toBe('星期六')
  })

  it.each([
    ['1,234.5', { value: 1234.5 }],
    ['-12', { value: -12 }],
    ['1e3', { value: 1000 }],
    ['12.5%', { value: 0.125, format: '0.0%' }],
    ['50%', { value: 0.5, format: '0%' }],
    ['¥1,200', { value: 1200, format: '¥#,##0' }],
    ['$12.50', { value: 12.5, format: '$#,##0.00' }],
    ['-€3', { value: -3, format: '€#,##0' }],
    ['£-3.5', { value: -3.5, format: '£#,##0.0' }],
    ['¥', { value: '¥' }],
    ['¥1,2', { value: '¥1,2' }],
    ['-¥-3', { value: '-¥-3' }],
    ['2026-03-05', { value: '2026-03-05' }],
    ['2026-3-5', { value: '2026-03-05', format: 'yyyy-m-d' }],
    ['2026/3/5', { value: '2026-03-05', format: 'yyyy/m/d' }],
    ['2026/03/05', { value: '2026-03-05', format: 'yyyy/mm/dd' }],
    ['2026.3.5', { value: '2026-03-05', format: 'yyyy.m.d' }],
    ['2026-03-05 09:30', { value: '2026-03-05 09:30' }],
    ['2026-03-05 9:30', { value: '2026-03-05 09:30', format: 'yyyy-mm-dd h:mm' }],
    ['2026/3/5 18:30:15', { value: '2026-03-05 18:30:15', format: 'yyyy/m/d hh:mm:ss' }],
    ['2026/3-5', { value: '2026/3-5' }],
    ['2026/2/30', { value: '2026/2/30' }],
    ['2026-03-05 25:00', { value: '2026-03-05 25:00' }],
    ['9:30', { value: '09:30', format: 'h:mm' }],
    ['09:30', { value: '09:30' }],
    ['18:30:15', { value: '18:30:15' }],
    ['24:00', { value: '24:00' }],
    ['9:60', { value: '9:60' }],
    ['true', { value: true }],
    ['FALSE', { value: false }],
    ["'007", { value: '007' }],
    ['=SUM(A1:A3)', { value: '=SUM(A1:A3)' }],
    ['上海', { value: '上海' }],
    ['', { value: null }],
  ])('reads %j', (text, input) => {
    expect(parseInput(text)).toEqual(input)
  })

  it('shows typed dates and times as typed', () => {
    for (const text of ['2026/3/5', '2026.3.5', '2026-3-5 9:30', '9:30', '¥1,200.50', '-$3'])
      expect(formatValue(parseInput(text).value, parseInput(text).format)).toBe(text)
  })

  it.each([
    ['007', "'007"],
    ['上海', '上海'],
    ['123', "'123"],
    ['9:30', "'9:30"],
    ['09:30', '09:30'],
    ['2026-03-05', '2026-03-05'],
    ['¥3', "'¥3"],
    [12.5, '12.5'],
    [true, 'TRUE'],
  ] as const)('starts editing %j as %j', (value, text) => {
    expect(inputText(value)).toBe(text)
    expect(parseInput(text).value).toBe(value)
  })
})

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '表 1',
      cells: [
        ['名称', '数量'],
        ['苹果', 3],
        ['梨', { value: 5, style: 'b' }],
      ],
    },
  ],
})

describe('transactions', () => {
  it('copies only the rows it changes', () => {
    const doc = book()
    const tr = new SheetTransaction(doc).setValue('B2', 4).setValue({ row: 1, col: 0 }, '青苹果')
    const next = tr.doc.sheets[0]!
    expect(next.cells[1]).toEqual(['青苹果', 4])
    expect(next.cells[0]).toBe(doc.sheets[0]!.cells[0])
    expect(next.cells[2]).toBe(doc.sheets[0]!.cells[2])
    expect(doc.sheets[0]!.cells[1]).toEqual(['苹果', 3])
    expect(applySheetSteps(tr.doc, tr.inverse).doc.sheets[0]!.cells[1]).toEqual(['苹果', 3])
  })

  it('keeps styles when a value changes and compacts cells', () => {
    const tr = new SheetTransaction(book()).setValue('B3', 6).setValue('B2', undefined)
    expect(tr.doc.sheets[0]!.cells[2]![1]).toEqual({ value: 6, style: 'b' })
    expect(tr.doc.sheets[0]!.cells[1]![1]).toBeUndefined()
    expect(compactCell({ value: 1 })).toBe(1)
    expect(compactCell({})).toBeUndefined()
  })

  it('skips steps that change nothing', () => {
    const tr = new SheetTransaction(book()).setValue('B2', 3)
    expect(tr.changed).toBe(false)
  })

  it('clears values in a range', () => {
    const tr = new SheetTransaction(book()).clearValues('A2:F6')
    expect(tr.doc.sheets[0]!.cells[2]).toEqual([undefined, { style: 'b' }])
    expect(tr.steps).toHaveLength(4)
  })

  it('sets sizes, sheet fields and styles', () => {
    const tr = new SheetTransaction(book())
      .setSize('col', 1, 120)
      .updateSheet({ freeze: { rows: 1 } })
      .setStyle('b', { bold: true })
    expect(tr.doc.sheets[0]!.colSizes).toEqual({ 1: 120 })
    expect(tr.doc.sheets[0]!.freeze).toEqual({ rows: 1 })
    expect(tr.doc.styles).toEqual({ b: { bold: true } })
    const back = applySheetSteps(tr.doc, tr.inverse).doc
    expect(back.sheets[0]!.colSizes).toEqual({})
    expect(back.sheets[0]!.freeze).toBeUndefined()
    expect(back.styles).toEqual({})
  })

  it('compacts repeated writes', () => {
    const steps = compactSheetSteps([
      { type: 'setCell', sheet: '表 1', row: 0, col: 0, cell: 1 },
      { type: 'setCell', sheet: '表 1', row: 0, col: 1, cell: 2 },
      { type: 'setCell', sheet: '表 1', row: 0, col: 0, cell: 3 },
    ])
    expect(steps).toHaveLength(2)
    expect(steps[0]).toMatchObject({ col: 0, cell: 3 })
  })

  it('counts rows and columns', () => {
    expect(rowCountOf({ name: 'a', cells: [] })).toBe(1000)
    expect(colCountOf({ name: 'a', cells: [Array(30)] })).toBe(30)
  })
})

describe('history', () => {
  it('undoes and redoes, merging groups', () => {
    const history = new SheetHistory()
    const view = { sheet: 0, selection: selectCell({ row: 0, col: 0 }) }
    let doc = book()
    for (const value of [4, 5]) {
      const tr = new SheetTransaction(doc).setValue('B2', value).setMeta({ group: 'typing' })
      history.record(tr, view, view)
      doc = tr.doc
    }
    const undone = history.undo(doc)!
    expect(undone.tr.doc.sheets[0]!.cells[1]![1]).toBe(3)
    expect(history.canUndo).toBe(false)
    expect(history.redo(undone.tr.doc)!.tr.doc.sheets[0]!.cells[1]![1]).toBe(5)
  })
})

describe('navigation', () => {
  const rows = new SheetAxis(10, 20, { 3: 0 })
  const cols = new SheetAxis(5, 80)
  const filled = new Set(['0:0', '1:0', '2:0', '6:0', '7:0'])
  const isFilled = (r: number, c: number) => filled.has(`${r}:${c}`)
  const down = (row: number, jump = false) =>
    movePoint({ row, col: 0 }, 'down', { rows, cols }, isFilled, jump).row

  it('skips hidden rows', () => {
    expect(down(2)).toBe(4)
    expect(down(9)).toBe(9)
  })

  it('jumps to the edges of filled blocks', () => {
    expect(down(0, true)).toBe(2)
    expect(down(2, true)).toBe(6)
    expect(down(6, true)).toBe(7)
    expect(down(7, true)).toBe(9)
  })
})
