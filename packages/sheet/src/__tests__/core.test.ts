import { describe, expect, it } from 'vitest'
import { columnIndex, columnName, formatRange, parseCell, parseRange } from '../core/address'
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
  it('shows numbers by pattern', () => {
    expect(formatValue(1234.5, '#,##0.00')).toBe('1,234.50')
    expect(formatValue(-1234.5, '#,##0')).toBe('-1,235')
    expect(formatValue(0.256, '0.0%')).toBe('25.6%')
    expect(formatValue(1.005, '0.00')).toBe('1.01')
    expect(formatValue(1.5, '0.##')).toBe('1.5')
    expect(formatValue(3, '¥#,##0.00')).toBe('¥3.00')
    expect(formatValue(3, '0"件"')).toBe('3件')
    expect(formatValue(-3, '0;(0)')).toBe('(3)')
    expect(formatValue(0.1 + 0.2)).toBe('0.3')
    expect(formatValue(true)).toBe('TRUE')
  })

  it('shows dates by pattern', () => {
    expect(formatValue('2026-03-05', 'yyyy/m/d')).toBe('2026/3/5')
    expect(formatValue('2026-03-05 09:07', 'mm-dd hh:mm')).toBe('03-05 09:07')
    expect(formatValue('不是日期', 'yyyy')).toBe('不是日期')
  })

  it('reads typed text', () => {
    expect(parseInput('1,234.5')).toEqual({ value: 1234.5 })
    expect(parseInput('12.5%')).toEqual({ value: 0.125, format: '0.0%' })
    expect(parseInput('2026/3/5')).toEqual({ value: '2026-03-05' })
    expect(parseInput('2026/2/30')).toEqual({ value: '2026/2/30' })
    expect(parseInput('true')).toEqual({ value: true })
    expect(parseInput("'007")).toEqual({ value: '007' })
    expect(parseInput('=SUM(A1:A3)')).toEqual({ value: '=SUM(A1:A3)' })
    expect(parseInput('上海')).toEqual({ value: '上海' })
    expect(parseInput('')).toEqual({ value: null })
    expect(inputText('007')).toBe("'007")
    expect(inputText('上海')).toBe('上海')
    expect(inputText('123')).toBe("'123")
    expect(parseInput(inputText('123')).value).toBe('123')
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
    const tr = new SheetTransaction(doc).setValue(0, 1, 1, 4).setValue(0, 1, 0, '青苹果')
    const next = tr.doc.sheets[0]!
    expect(next.cells[1]).toEqual(['青苹果', 4])
    expect(next.cells[0]).toBe(doc.sheets[0]!.cells[0])
    expect(next.cells[2]).toBe(doc.sheets[0]!.cells[2])
    expect(doc.sheets[0]!.cells[1]).toEqual(['苹果', 3])
    expect(applySheetSteps(tr.doc, tr.inverse).doc.sheets[0]!.cells[1]).toEqual(['苹果', 3])
  })

  it('keeps styles when a value changes and compacts cells', () => {
    const tr = new SheetTransaction(book()).setValue(0, 2, 1, 6).setValue(0, 1, 1, undefined)
    expect(tr.doc.sheets[0]!.cells[2]![1]).toEqual({ value: 6, style: 'b' })
    expect(tr.doc.sheets[0]!.cells[1]![1]).toBeUndefined()
    expect(compactCell({ value: 1 })).toBe(1)
    expect(compactCell({})).toBeUndefined()
  })

  it('skips steps that change nothing', () => {
    const tr = new SheetTransaction(book()).setValue(0, 1, 1, 3)
    expect(tr.changed).toBe(false)
  })

  it('clears values in a range', () => {
    const tr = new SheetTransaction(book()).clearValues(0, { top: 1, left: 0, bottom: 5, right: 5 })
    expect(tr.doc.sheets[0]!.cells[2]).toEqual([undefined, { style: 'b' }])
    expect(tr.steps).toHaveLength(4)
  })

  it('sets sizes, sheet fields and styles', () => {
    const tr = new SheetTransaction(book())
      .setSize(0, 'col', 1, 120)
      .updateSheet(0, { freeze: { rows: 1 } })
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
      { type: 'setCell', sheet: 0, row: 0, col: 0, cell: 1 },
      { type: 'setCell', sheet: 0, row: 0, col: 1, cell: 2 },
      { type: 'setCell', sheet: 0, row: 0, col: 0, cell: 3 },
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
      const tr = new SheetTransaction(doc).setValue(0, 1, 1, value).setMeta({ group: 'typing' })
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
