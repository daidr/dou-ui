import { describe, expect, it } from 'vitest'
import { moveReferences, shiftFormula } from '../core/address'
import { parseTSV, parseClip, formatClip } from '../core/clipboard'
import { continueValues, fillContinues } from '../core/fill'
import { mergesOf } from '../core/merge'
import type { SheetWorkbook } from '../core/model'
import { applySheetSteps, SheetTransaction } from '../core/transaction'

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '表 1',
      cells: [
        ['A1', 'B1', 'C1'],
        ['A2', 'B2', 'C2'],
        ['A3', 'B3', 'C3'],
      ],
      rowSizes: { 1: 40 },
      colSizes: { 2: 120 },
      freeze: { rows: 1, cols: 1 },
    },
  ],
})

const cells = (tr: SheetTransaction) => tr.doc.sheets[0]!.cells
const undo = (tr: SheetTransaction) => applySheetSteps(tr.doc, tr.inverse).doc

describe('rows and columns', () => {
  it('inserts rows and undoes it', () => {
    const doc = book()
    const tr = new SheetTransaction(doc).insertRows(1, 2)
    expect(cells(tr)).toEqual([
      ['A1', 'B1', 'C1'],
      null,
      null,
      ['A2', 'B2', 'C2'],
      ['A3', 'B3', 'C3'],
    ])
    expect(tr.doc.sheets[0]!.rowSizes).toEqual({ 3: 40 })
    expect(undo(tr).sheets[0]).toEqual(doc.sheets[0])
  })

  it('grows the frozen rows when inserting inside them', () => {
    const tr = new SheetTransaction(book()).insertRows(0)
    expect(tr.doc.sheets[0]!.freeze).toEqual({ rows: 2, cols: 1 })
    expect(new SheetTransaction(book()).insertRows(1).doc.sheets[0]!.freeze).toEqual({
      rows: 1,
      cols: 1,
    })
  })

  it('inserts columns', () => {
    const tr = new SheetTransaction(book()).insertCols(1)
    expect(cells(tr)[0]).toEqual(['A1', undefined, 'B1', 'C1'])
    expect(tr.doc.sheets[0]!.colSizes).toEqual({ 3: 120 })
    expect(tr.doc.sheets[0]!.freeze).toEqual({ rows: 1, cols: 1 })
  })

  it('deletes rows and columns and brings them back on undo', () => {
    const doc = book()
    const rows = new SheetTransaction(doc).deleteRows(0, 2)
    expect(cells(rows)).toEqual([['A3', 'B3', 'C3']])
    expect(rows.doc.sheets[0]!.rowSizes).toEqual({})
    expect(rows.doc.sheets[0]!.freeze).toEqual({ rows: 0, cols: 1 })
    expect(undo(rows).sheets[0]).toEqual(doc.sheets[0])

    const cols = new SheetTransaction(doc).deleteCols(1, 2)
    expect(cells(cols)).toEqual([['A1'], ['A2'], ['A3']])
    expect(cols.doc.sheets[0]!.colSizes).toEqual({})
    expect(undo(cols).sheets[0]).toEqual(doc.sheets[0])
  })

  it('keeps an explicit row count in step', () => {
    const doc = book()
    doc.sheets[0]!.rowCount = 10
    expect(new SheetTransaction(doc).insertRows(0, 3).doc.sheets[0]!.rowCount).toBe(13)
    expect(new SheetTransaction(doc).deleteRows(0, 3).doc.sheets[0]!.rowCount).toBe(7)
  })

  it('moves rows and columns either way', () => {
    const doc = book()
    const down = new SheetTransaction(doc).moveRows(0, 3)
    expect(cells(down).map((line) => line?.[0])).toEqual(['A2', 'A3', 'A1'])
    expect(down.doc.sheets[0]!.rowSizes).toEqual({ 0: 40 })
    expect(undo(down).sheets[0]!.cells).toEqual(doc.sheets[0]!.cells)

    const left = new SheetTransaction(doc).moveCols('C', 'A')
    expect(cells(left)[1]).toEqual(['C2', 'A2', 'B2'])
    expect(left.doc.sheets[0]!.colSizes).toEqual({ 0: 120 })
    expect(undo(left).sheets[0]!.cells).toEqual(doc.sheets[0]!.cells)
    expect(new SheetTransaction(doc).moveRows(1, 2).changed).toBe(false)
    const block = new SheetTransaction(doc).moveRows('1:2', '4')
    expect(cells(block).map((line) => line?.[0])).toEqual(['A3', 'A1', 'A2'])
  })

  it('takes rows and columns as people write them', () => {
    const doc = book()
    expect(cells(new SheetTransaction(doc).deleteRows('2:3'))).toEqual([['A1', 'B1', 'C1']])
    expect(cells(new SheetTransaction(doc).deleteCols('B:C'))[0]).toEqual(['A1'])
    expect(cells(new SheetTransaction(doc).insertRows('2:3'))[3]).toEqual(['A2', 'B2', 'C2'])
    expect(cells(new SheetTransaction(doc).insertCols('B'))[0]).toEqual([
      'A1',
      undefined,
      'B1',
      'C1',
    ])
    expect(() => new SheetTransaction(doc).deleteRows('B')).toThrow(RangeError)
  })

  it('writes blocks of cells', () => {
    const tr = new SheetTransaction(book()).setCells('B3', [
      [1, 2],
      [3, undefined],
    ])
    expect(cells(tr)[2]).toEqual(['A3', 1, 2])
    expect(cells(tr)[3]).toEqual([undefined, 3])
  })
})

describe('fill', () => {
  it.each([
    [[1], 3, 'auto', [1, 1, 1]],
    [[1], 3, 'series', [2, 3, 4]],
    [[1, 3], 3, 'auto', [5, 7, 9]],
    [[0.1, 0.2], 2, 'auto', [0.3, 0.4]],
    [[1, 3], 2, 'copy', [1, 3]],
    [[1, 2, 4], 1, 'auto', [5.33333333333333]],
    [['2026-10-30'], 2, 'auto', ['2026-10-31', '2026-11-01']],
    [['2026-01-01', '2026-01-08'], 1, 'auto', ['2026-01-15']],
    [['2026-01-31', '2026-02-28'], 2, 'auto', ['2026-03-31', '2026-04-30']],
    [['2026-02-28', '2026-03-28'], 1, 'auto', ['2026-04-28']],
    [['2026-01-15', '2026-02-15'], 2, 'auto', ['2026-03-15', '2026-04-15']],
    [['2026-01-31', '2026-03-31'], 1, 'auto', ['2026-05-31']],
    [['23:00'], 2, 'auto', ['00:00', '01:00']],
    [['09:00', '09:30'], 2, 'auto', ['10:00', '10:30']],
    [['第 1 周'], 2, 'auto', ['第 2 周', '第 3 周']],
    [['A-008', 'A-010'], 1, 'auto', ['A-012']],
    [['第 1 周', '第 2 周'], 2, 'copy', ['第 1 周', '第 2 周']],
    [['上海', '北京'], 3, 'auto', ['上海', '北京', '上海']],
    [[1, '上海'], 2, 'auto', [1, '上海']],
    [['007'], 1, 'auto', ['007']],
    [[true], 1, 'series', [true]],
  ] as const)('continues %j by %i (%s)', (values, count, mode, next) => {
    expect(continueValues(values, count, { mode })).toEqual(next)
  })

  it('says whether it continues, for Ctrl to do the other', () => {
    expect(fillContinues([1])).toBe(false)
    expect(fillContinues([1, 2])).toBe(true)
    expect(fillContinues(['第 1 周'])).toBe(true)
    expect(fillContinues(['上海'])).toBe(false)
  })

  it('fills ranges with styles and moved formulas', () => {
    const doc: SheetWorkbook = {
      sheets: [
        {
          name: '表 1',
          cells: [
            [{ value: 1, style: 'b' }, '=A1*2'],
            [{ value: 2, style: 'b' }, '=A2*2'],
          ],
        },
      ],
    }
    const tr = new SheetTransaction(doc).fill('A1:B2', 'A1:B4')
    expect(cells(tr)[2]).toEqual([{ value: 3, style: 'b' }, '=A3*2'])
    expect(cells(tr)[3]).toEqual([{ value: 4, style: 'b' }, '=A4*2'])
    const up = new SheetTransaction(doc).fill('A1:A2', { top: 0, left: 0, bottom: 1, right: 0 })
    expect(up.changed).toBe(false)
    expect(() => new SheetTransaction(doc).fill('A1:A2', 'A1:B3')).toThrow(RangeError)
  })

  it('fills upwards and to the left', () => {
    const doc: SheetWorkbook = { sheets: [{ name: '表 1', cells: [[], [], [null, null, 5, 6]] }] }
    const left = new SheetTransaction(doc).fill('C3:D3', 'A3:D3')
    expect(cells(left)[2]).toEqual([3, 4, 5, 6])
    const updoc: SheetWorkbook = { sheets: [{ name: '表 1', cells: [[], [], ['第 3 周']] }] }
    expect(cells(new SheetTransaction(updoc).fill('A3', 'A1:A3')).map((l) => l?.[0])).toEqual([
      '第 1 周',
      '第 2 周',
      '第 3 周',
    ])
  })
})

describe('formulas', () => {
  it.each([
    ['=A1+B2', 1, 1, '=B2+C3'],
    ['=$A1+A$1+$A$1', 2, 2, '=$A3+C$1+$A$1'],
    ['=SUM(A1:A3)', 0, 1, '=SUM(B1:B3)'],
    ['=LOG10(A1)', 1, 0, '=LOG10(A2)'],
    ['="A1"&A1', 1, 0, '="A1"&A2'],
    ['=A1', -1, 0, '=#REF!'],
    ["='表 2'!A1", 1, 0, "='表 2'!A2"],
    ['上海', 1, 1, '上海'],
  ])('moves %s by %i, %i', (formula, rows, cols, moved) => {
    expect(shiftFormula(formula, rows, cols)).toBe(moved)
  })
})

const formulas = (): SheetWorkbook => ({
  sheets: [
    {
      name: '表1',
      cells: [
        [1, 2, 3],
        [4, 5, 6],
        ['=A2+SUM(B1:B2)', '=$C$2*2', "='表2'!A1"],
      ],
    },
    { name: '表2', cells: [['=表1!A2', "='表1'!B1:C2"]] },
  ],
})
const insertAtRow2 = (b: { top: number; bottom: number; left: number; right: number }) =>
  b.left === 0 && b.right === Infinity && b.top === 0 && b.bottom === Infinity
    ? b
    : {
        ...b,
        top: b.top >= 1 ? b.top + 1 : b.top,
        bottom: b.bottom >= 1 ? b.bottom + 1 : b.bottom,
      }

const other = (tr: SheetTransaction) => tr.doc.sheets[1]!.cells[0]

describe('references', () => {
  it('follow inserted rows and columns', () => {
    const rows = new SheetTransaction(formulas()).insertRows(1)
    expect(cells(rows)[3]).toEqual(['=A3+SUM(B1:B3)', '=$C$3*2', "='表2'!A1"])
    expect(other(rows)).toEqual(['=表1!A3', "='表1'!B1:C3"])
    const cols = new SheetTransaction(formulas()).insertCols(0)
    expect(cells(cols)[2]).toEqual([undefined, '=B2+SUM(C1:C2)', '=$D$2*2', "='表2'!A1"])
    expect(undo(cols)).toEqual(formulas())
  })

  it('read #REF! when their cells are deleted', () => {
    const tr = new SheetTransaction(formulas()).deleteRows(1)
    expect(cells(tr)[1]).toEqual(['=#REF!+SUM(B1:B1)', '=#REF!*2', "='表2'!A1"])
    expect(other(tr)).toEqual(['=表1!#REF!', "='表1'!B1:C1"])
    expect(undo(tr)).toEqual(formulas())
  })

  it('follow moved rows', () => {
    const tr = new SheetTransaction(formulas()).moveRows(1, 0)
    expect(cells(tr)[2]).toEqual(['=A1+SUM(B1:B2)', '=$C$1*2', "='表2'!A1"])
  })

  it('follow cut cells', () => {
    const tr = new SheetTransaction(formulas()).moveCells('A2:B2', 'A5')
    expect(cells(tr)[1]).toEqual([undefined, undefined, 6])
    expect(cells(tr)[4]).toEqual([4, 5])
    expect(cells(tr)[2]![0]).toBe('=A5+SUM(B1:B2)')
    expect(other(tr)![0]).toBe('=表1!A5')
    expect(undo(tr).sheets[0]!.cells.slice(0, 3)).toEqual(formulas().sheets[0]!.cells)
    expect(undo(tr).sheets[1]).toEqual(formulas().sheets[1])
  })

  it.each([
    ['=A1:A3', '=A1:A4'],
    ['=SUM(B:B)+SUM(2:3)', '=SUM(B:B)+SUM(3:4)'],
    ['="A2"&A2', '="A2"&A3'],
    ['=LOG10(A2)', '=LOG10(A3)'],
  ])('rewrite %s', (formula, moved) => {
    expect(moveReferences(formula, '表1', '表1', insertAtRow2)).toBe(moved)
  })
})

describe('clipboard', () => {
  it('writes text and a table', () => {
    const clip = formatClip({
      cells: [
        [{ value: 1200, format: '#,##0', style: 'b' }, '上海'],
        ['两行\n文字', 'a\tb'],
      ],
      styles: { b: { bold: true } },
    })
    expect(clip.text).toBe('1,200\t上海\n"两行\n文字"\t"a\tb"')
    expect(clip.html).toContain('<td style="font-weight:bold;text-align:right;">1,200</td>')
    expect(clip.html).toContain('两行<br>文字')
  })

  it('reads back its own cells as they were', () => {
    const source = {
      cells: [[{ value: '2026-03-05', format: 'yyyy/m/d' }, '=A1']],
      styles: { b: { bold: true } },
      from: { row: 2, col: 1 },
    }
    expect(parseClip(formatClip(source))).toEqual(source)
  })

  it('reads tables from other programs', () => {
    const html = `<html><body><!--StartFragment--><table>
      <tr><th>物品</th><th colspan="2">数量</th></tr>
      <tr><td rowspan="2">键盘</td><td>1,200</td><td>12.5%</td></tr>
      <tr><td>2026/3/5</td><td><p>第一行</p><p>第二行</p></td></tr>
    </table><!--EndFragment--></body></html>`
    expect(parseClip({ html })!.cells).toEqual([
      ['物品', '数量', undefined],
      ['键盘', 1200, { value: 0.125, format: '0.0%' }],
      [undefined, { value: '2026-03-05', format: 'yyyy/m/d' }, '第一行\n第二行'],
    ])
  })

  it('reads tab-separated text', () => {
    expect(parseTSV('a\tb\n"x\ny"\t"say ""hi"""\r\nc')).toEqual([
      ['a', 'b'],
      ['x\ny', 'say "hi"'],
      ['c'],
    ])
    expect(parseClip({ text: '12\t上海\n' })!.cells).toEqual([[12, '上海']])
    expect(parseClip({ text: '' })).toBeNull()
  })
})

describe('merged cells', () => {
  const merged = (): SheetWorkbook => ({
    sheets: [
      {
        name: '表1',
        cells: [
          ['季度', null, '合计'],
          [1, 2, 3],
          [4, 5, 6],
        ],
        merges: ['A1:B1'],
      },
    ],
  })

  it('merges a range, keeping the top left value, and splits it again', () => {
    const tr = new SheetTransaction(merged()).mergeCells('A2:B3')
    expect(tr.doc.sheets[0]!.merges).toEqual(['A1:B1', 'A2:B3'])
    expect(cells(tr)[1]).toEqual([1, undefined, 3])
    expect(cells(tr)[2]).toEqual([undefined, undefined, 6])
    expect(undo(tr)).toEqual(merged())
    const split = new SheetTransaction(tr.doc).unmergeCells('B2')
    expect(split.doc.sheets[0]!.merges).toEqual(['A1:B1'])
  })

  it('takes in the merges a new merge touches', () => {
    const tr = new SheetTransaction(merged()).mergeCells('B1:C1')
    expect(tr.doc.sheets[0]!.merges).toEqual(['A1:C1'])
    expect(cells(tr)[0]).toEqual(['季度', null, undefined])
  })

  it('move with inserted, deleted and moved lines', () => {
    expect(new SheetTransaction(merged()).insertRows(0).doc.sheets[0]!.merges).toEqual(['A2:B2'])
    expect(new SheetTransaction(merged()).insertCols(1).doc.sheets[0]!.merges).toEqual(['A1:C1'])
    // shrunk to one cell: no longer a merge
    expect(new SheetTransaction(merged()).deleteCols(1).doc.sheets[0]!.merges).toBeUndefined()
    expect(new SheetTransaction(merged()).moveRows(0, 3).doc.sheets[0]!.merges).toEqual(['A3:B3'])
  })

  it('reads merges once and grows ranges to take them in', () => {
    const m = mergesOf(merged().sheets[0]!)
    expect(m.at(0, 1)).toEqual({ top: 0, left: 0, bottom: 0, right: 1 })
    expect(m.anchor({ row: 0, col: 1 })).toEqual({ row: 0, col: 0 })
    expect(m.expand({ top: 0, left: 1, bottom: 1, right: 1 })).toEqual({
      top: 0,
      left: 0,
      bottom: 1,
      right: 1,
    })
    expect(m.at(1, 1)).toBeUndefined()
  })
})
