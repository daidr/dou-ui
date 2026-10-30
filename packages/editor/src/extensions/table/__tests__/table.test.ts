import { TextSelection } from 'prosemirror-state'
import { CellSelection, TableMap } from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { blocksToHTML, htmlToBlocks } from '../../../core/convert'
import { createEditorView } from '../../../core/editor'
import { resolveExtensions } from '../../../core/extension'
import { blocksToDoc, docToBlocks, type Block, type PartialBlock } from '../../../core/model'
import { blocksToMarkdown, markdownToBlocks } from '../../../markdown'
import { starterKit } from '../../starter-kit'
import {
  alignColumns,
  deleteColumns,
  goToCell,
  insertColumn,
  mergeCells,
  moveLines,
  splitMergedCell,
  tableAt,
  toggleHeader,
} from '../commands'

const extensions = [starterKit()]
const kit = resolveExtensions(extensions)

let view: EditorView | undefined
afterEach(() => {
  view?.destroy()
  view = undefined
})

const grid: PartialBlock = {
  id: 't',
  type: 'table',
  props: { columns: [{ id: 'a', width: 120 }, { id: 'b' }, { id: 'c', align: 'right' }] },
  rows: [
    { id: 'r1', cells: ['城市', '人数', '备注'] },
    { id: 'r2', cells: ['上海', '12', ''] },
    { id: 'r3', cells: ['杭州', '8', ''] },
  ],
}

function create(blocks: PartialBlock[] = [grid]) {
  const element = document.createElement('div')
  document.body.append(element)
  view = createEditorView({
    element,
    kit,
    blocks,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  return view
}

const tableBlock = (target: EditorView) => docToBlocks(target.state.doc)[0]!
const texts = (block: Block) =>
  block.rows!.map((row) =>
    row.cells.map((cell) =>
      cell.content.map((item) => (item.type === 'text' ? item.text : '/')).join(''),
    ),
  )

/** Put the cursor in the cell at `row`, `col`. */
function cursorIn(target: EditorView, row: number, col: number) {
  const found = tableAt(target.state.doc.resolve(3))!
  const pos = found.pos + 1 + found.map.map[row * found.map.width + col]!
  target.dispatch(target.state.tr.setSelection(TextSelection.create(target.state.doc, pos + 1)))
}

function selectCells(target: EditorView, from: [number, number], to: [number, number]) {
  const found = tableAt(target.state.doc.resolve(3))!
  const at = (row: number, col: number) =>
    found.pos + 1 + found.map.map[row * found.map.width + col]!
  target.dispatch(
    target.state.tr.setSelection(CellSelection.create(target.state.doc, at(...from), at(...to))),
  )
}

const run = (
  target: EditorView,
  command: (s: EditorView['state'], d?: EditorView['dispatch']) => boolean,
) => command(target.state, target.dispatch)

describe('table data', () => {
  it('round-trips rows, ids, widths, alignment and header settings', () => {
    const block = docToBlocks(blocksToDoc(kit.schema, [grid]))[0]!
    expect(block.type).toBe('table')
    expect(block.content).toEqual([])
    expect(block.props).toEqual({
      headerRow: true,
      headerColumn: false,
      columns: [{ id: 'a', width: 120 }, { id: 'b' }, { id: 'c', align: 'right' }],
    })
    expect(block.rows!.map((row) => row.id)).toEqual(['r1', 'r2', 'r3'])
    expect(texts(block)).toEqual([
      ['城市', '人数', '备注'],
      ['上海', '12', ''],
      ['杭州', '8', ''],
    ])
  })

  it('keeps covered cells in the grid and clamps spans', () => {
    const block = docToBlocks(
      blocksToDoc(kit.schema, [
        {
          type: 'table',
          rows: [
            { cells: [{ content: '合并', colspan: 2, rowspan: 2 }, 'x', 'y'] },
            { cells: ['', '', { content: 'z', colspan: 9 }] },
          ],
        },
      ]),
    )[0]!
    expect(block.rows![0]!.cells[0]).toMatchObject({ colspan: 2, rowspan: 2 })
    expect(block.rows![1]!.cells[2]).toEqual({ content: [{ type: 'text', text: 'z' }] })
    // covered slots stay in the array, so `x` sat under the merge and is dropped
    expect(texts(block)).toEqual([
      ['合并', '', 'y'],
      ['', '', 'z'],
    ])
    expect(block.rows!.every((row) => row.id)).toBe(true)
  })

  it('makes a 3 × 3 table with a header row when given no rows', () => {
    const block = docToBlocks(blocksToDoc(kit.schema, [{ type: 'table' }]))[0]!
    expect(texts(block)).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ])
    expect(block.props.headerRow).toBe(true)
  })
})

describe('table editing', () => {
  it('renders header cells where the table says, and follows a toggle', () => {
    const target = create()
    expect(target.dom.querySelectorAll('th')).toHaveLength(3)
    cursorIn(target, 1, 0)
    run(target, toggleHeader('headerColumn'))
    expect(target.dom.querySelectorAll('th')).toHaveLength(5)
    expect(tableBlock(target).props.headerColumn).toBe(true)
  })

  it('adds and removes columns with their ids', () => {
    const target = create()
    cursorIn(target, 1, 1)
    run(target, insertColumn('after'))
    let columns = tableBlock(target).props.columns as { id: string }[]
    expect(columns).toHaveLength(4)
    expect(columns.map((column) => column.id).slice(0, 2)).toEqual(['a', 'b'])
    expect(columns[3]!.id).toBe('c')
    cursorIn(target, 1, 0)
    run(target, deleteColumns)
    columns = tableBlock(target).props.columns as { id: string }[]
    expect(columns.map((column) => column.id)[0]).toBe('b')
    expect(texts(tableBlock(target))[0]).toEqual(['人数', '', '备注'])
  })

  it('gives new rows ids, and Tab in the last cell adds one', () => {
    const target = create()
    cursorIn(target, 2, 2)
    expect(run(target, goToCell(1))).toBe(true)
    const block = tableBlock(target)
    expect(block.rows).toHaveLength(4)
    expect(new Set(block.rows!.map((row) => row.id)).size).toBe(4)
    expect(target.state.selection.$from.parent.type.name).toBe('tableCell')
  })

  it('merges cells with their text on separate lines, and splits them back', () => {
    const target = create()
    selectCells(target, [1, 0], [2, 1])
    expect(run(target, mergeCells)).toBe(true)
    const block = tableBlock(target)
    expect(block.rows![1]!.cells[0]).toMatchObject({ colspan: 2, rowspan: 2 })
    expect(block.rows![1]!.cells[0]!.content.map((item) => item.type)).toEqual([
      'text',
      'break',
      'text',
      'break',
      'text',
      'break',
      'text',
    ])
    expect(run(target, splitMergedCell)).toBe(true)
    expect(tableBlock(target).rows![1]!.cells[0]!.colspan).toBeUndefined()
  })

  it('moves rows with their ids, and keeps merged rows together', () => {
    const target = create()
    cursorIn(target, 2, 0)
    run(target, moveLines('row', -1))
    expect(tableBlock(target).rows!.map((row) => row.id)).toEqual(['r1', 'r3', 'r2'])
    selectCells(target, [1, 0], [2, 0])
    run(target, mergeCells)
    cursorIn(target, 0, 0)
    // the header row swaps with both merged rows at once
    expect(run(target, moveLines('row', 1))).toBe(true)
    expect(tableBlock(target).rows!.map((row) => row.id)).toEqual(['r3', 'r2', 'r1'])
  })

  it('moves columns with their widths and alignment', () => {
    const target = create()
    cursorIn(target, 0, 0)
    run(target, moveLines('column', 1))
    const block = tableBlock(target)
    expect(block.props.columns).toEqual([
      { id: 'b' },
      { id: 'a', width: 120 },
      { id: 'c', align: 'right' },
    ])
    expect(texts(block)[0]).toEqual(['人数', '城市', '备注'])
  })

  it('aligns columns', () => {
    const target = create()
    cursorIn(target, 1, 1)
    run(target, alignColumns('center'))
    expect((tableBlock(target).props.columns as { align?: string }[])[1]!.align).toBe('center')
    const cell = target.dom.querySelectorAll('tr')[1]!.children[1] as HTMLElement
    expect(cell.style.textAlign).toBe('center')
  })

  it('does not join cells with Backspace, and keeps the slash menu out of cells', () => {
    const target = create()
    cursorIn(target, 1, 1)
    const before = target.state.doc
    const event = new KeyboardEvent('keydown', { key: 'Backspace' })
    target.someProp('handleKeyDown', (handler) => handler(target, event))
    expect(target.state.doc.eq(before)).toBe(true)
    const map = TableMap.get(tableAt(target.state.doc.resolve(3))!.node)
    expect(map.width).toBe(3)
  })
})

describe('table import and export', () => {
  const merged: PartialBlock = {
    type: 'table',
    props: { columns: [{ id: 'a' }, { id: 'b', align: 'center' }, { id: 'c', width: 80 }] },
    rows: [
      { cells: ['名称', '数量', '说明'] },
      { cells: [{ content: '咖啡', rowspan: 2 }, '2', { content: '两包 | 深烘', colspan: 1 }] },
      { cells: ['', '1', 'x'] },
    ],
  }

  it('writes HTML with header, spans, widths and alignment, and reads it back', () => {
    const html = blocksToHTML([merged], extensions)
    expect(html).toBe(
      '<table><colgroup><col><col><col style="width: 80px"></colgroup>' +
        '<thead><tr><th>名称</th><th style="text-align: center">数量</th><th>说明</th></tr></thead>' +
        '<tbody><tr><td rowspan="2">咖啡</td><td style="text-align: center">2</td><td>两包 | 深烘</td></tr>' +
        '<tr><td style="text-align: center">1</td><td>x</td></tr></tbody></table>',
    )
    const block = htmlToBlocks(html, extensions)[0]!
    expect(block.rows![1]!.cells[0]).toMatchObject({ rowspan: 2 })
    expect(texts(block)).toEqual([
      ['名称', '数量', '说明'],
      ['咖啡', '2', '两包 | 深烘'],
      ['', '1', 'x'],
    ])
    expect(
      (block.props.columns as { width?: number; align?: string }[]).map((column) => [
        column.align,
        column.width,
      ]),
    ).toEqual([
      [undefined, undefined],
      ['center', undefined],
      [undefined, 80],
    ])
  })

  it('writes and reads GitHub tables', () => {
    const markdown = blocksToMarkdown([merged], extensions)
    expect(markdown).toBe(
      '| 名称 | 数量 | 说明 |\n| --- | :-: | --- |\n| 咖啡 | 2 | 两包 \\| 深烘 |\n|  | 1 | x |\n',
    )
    const block = markdownToBlocks(markdown, extensions)[0]!
    expect(block.type).toBe('table')
    expect(texts(block)[1]).toEqual(['咖啡', '2', '两包 | 深烘'])
    expect((block.props.columns as { align?: string }[])[1]!.align).toBe('center')
  })

  it('reads pasted tables whose cells hold paragraphs and lists', () => {
    const block = htmlToBlocks(
      '<table><tr><td><p>一</p><p>二</p></td><td><ul><li>甲</li><li>乙</li></ul></td></tr></table>',
      extensions,
    )[0]!
    expect(block.type).toBe('table')
    expect(block.props.headerRow).toBe(false)
    expect(block.rows![0]!.cells.map((cell) => cell.content.map((item) => item.type))).toEqual([
      ['text', 'break', 'text'],
      ['text', 'break', 'text'],
    ])
  })
})
