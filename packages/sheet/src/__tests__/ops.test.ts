import { describe, expect, it } from 'vitest'
import { shiftFormula } from '../core/address'
import { parseTSV, readClip, writeClip } from '../core/clipboard'
import { continueValues } from '../core/fill'
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
    const down = new SheetTransaction(doc).moveRows(0, 1, 3)
    expect(cells(down).map((line) => line?.[0])).toEqual(['A2', 'A3', 'A1'])
    expect(down.doc.sheets[0]!.rowSizes).toEqual({ 0: 40 })
    expect(undo(down).sheets[0]!.cells).toEqual(doc.sheets[0]!.cells)

    const left = new SheetTransaction(doc).moveCols(2, 1, 0)
    expect(cells(left)[1]).toEqual(['C2', 'A2', 'B2'])
    expect(left.doc.sheets[0]!.colSizes).toEqual({ 0: 120 })
    expect(undo(left).sheets[0]!.cells).toEqual(doc.sheets[0]!.cells)
    expect(new SheetTransaction(doc).moveRows(1, 1, 2).changed).toBe(false)
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
    [[1], 3, false, [1, 1, 1]],
    [[1], 3, true, [2, 3, 4]],
    [[1, 3], 3, false, [5, 7, 9]],
    [[0.1, 0.2], 2, false, [0.3, 0.4]],
    [[1, 3], 2, true, [1, 3]],
    [[1, 2, 4], 1, false, [5.33333333333333]],
    [['2026-10-30'], 2, false, ['2026-10-31', '2026-11-01']],
    [['2026-01-01', '2026-01-08'], 1, false, ['2026-01-15']],
    [['2026-01-31', '2026-02-28'], 1, false, ['2026-03-28']],
    [['2026-01-15', '2026-02-15'], 2, false, ['2026-03-15', '2026-04-15']],
    [['2026-01-31', '2026-03-31'], 1, false, ['2026-05-31']],
    [['23:00'], 2, false, ['00:00', '01:00']],
    [['09:00', '09:30'], 2, false, ['10:00', '10:30']],
    [['第 1 周'], 2, false, ['第 2 周', '第 3 周']],
    [['A-008', 'A-010'], 1, false, ['A-012']],
    [['第 1 周', '第 2 周'], 2, true, ['第 1 周', '第 2 周']],
    [['上海', '北京'], 3, false, ['上海', '北京', '上海']],
    [[1, '上海'], 2, false, [1, '上海']],
    [['007'], 1, false, ['007']],
    [[true], 1, false, [true]],
  ] as const)('continues %j by %i (invert %s)', (values, count, invert, next) => {
    expect(continueValues(values, count, invert)).toEqual(next)
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

describe('clipboard', () => {
  it('writes text and a table', () => {
    const clip = writeClip({
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
    expect(readClip(writeClip(source))).toEqual(source)
  })

  it('reads tables from other programs', () => {
    const html = `<html><body><!--StartFragment--><table>
      <tr><th>物品</th><th colspan="2">数量</th></tr>
      <tr><td rowspan="2">键盘</td><td>1,200</td><td>12.5%</td></tr>
      <tr><td>2026/3/5</td><td><p>第一行</p><p>第二行</p></td></tr>
    </table><!--EndFragment--></body></html>`
    expect(readClip({ html })!.cells).toEqual([
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
    expect(readClip({ text: '12\t上海\n' })!.cells).toEqual([[12, '上海']])
    expect(readClip({ text: '' })).toBeNull()
  })
})
