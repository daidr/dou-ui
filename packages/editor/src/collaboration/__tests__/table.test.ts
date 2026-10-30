import { TextSelection } from 'prosemirror-state'
import { CellSelection } from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { collaboration, fillMap } from '..'
import { createEditorView, getBlocks } from '../../core/editor'
import { resolveExtensions } from '../../core/extension'
import type { Block, PartialBlock } from '../../core/model'
import { starterKit } from '../../extensions/starter-kit'
import {
  deleteColumns,
  deleteRows,
  insertColumn,
  insertRow,
  mergeCells,
  moveLines,
  splitMergedCell,
  tableAt,
} from '../../extensions/table/commands'
import { placeOf, positionOf } from '../cursors'

const views: EditorView[] = []
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(async () => {
  await tick()
  for (const view of views.splice(0)) view.destroy()
})

const kits = new WeakMap<EditorView, ReturnType<typeof resolveExtensions>>()

function client(doc: Y.Doc) {
  const kit = resolveExtensions([starterKit(), collaboration({ map: doc.getMap('document') })])
  const element = document.createElement('div')
  document.body.append(element)
  const view = createEditorView({
    element,
    kit,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  views.push(view)
  kits.set(view, kit)
  return view
}

const undo = (view: EditorView) => kits.get(view)!.history!.undo(view.state, view.dispatch)

function connect(a: Y.Doc, b: Y.Doc) {
  let online = true
  const pending: [Y.Doc, Uint8Array][] = []
  const relay = (from: Y.Doc, to: Y.Doc) =>
    from.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'relay') return
      if (online) Y.applyUpdate(to, update, 'relay')
      else pending.push([to, update])
    })
  relay(a, b)
  relay(b, a)
  return {
    offline: () => (online = false),
    online: () => {
      online = true
      for (const [to, update] of pending.splice(0)) Y.applyUpdate(to, update, 'relay')
    },
  }
}

const TABLE: PartialBlock = {
  id: 't',
  type: 'table',
  props: { columns: [{ id: 'x', width: 120 }, { id: 'y' }, { id: 'z', align: 'right' }] },
  rows: [
    { id: 'r1', cells: ['城市', '人数', '备注'] },
    { id: 'r2', cells: ['上海', '12', ''] },
    { id: 'r3', cells: ['杭州', '8', ''] },
  ],
}

function pair(blocks: PartialBlock[] = [TABLE]) {
  const source = new Y.Doc()
  fillMap(source.getMap('document'), blocks)
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  Y.applyUpdate(docA, Y.encodeStateAsUpdate(source))
  Y.applyUpdate(docB, Y.encodeStateAsUpdate(source))
  const a = client(docA)
  const b = client(docB)
  return { a, b, docA, line: connect(docA, docB) }
}

const table = (view: EditorView): Block => getBlocks(view).find((block) => block.type === 'table')!

/** The table's text, with merged cells as `text(rows×cols)`. */
function grid(view: EditorView) {
  return table(view).rows!.map((row) =>
    row.cells.map((cell) => {
      const text = cell.content.map((item) => (item.type === 'text' ? item.text : '/')).join('')
      return cell.rowspan || cell.colspan
        ? `${text}(${cell.rowspan ?? 1}×${cell.colspan ?? 1})`
        : text
    }),
  )
}

function expectSame(a: EditorView, b: EditorView) {
  expect(table(b)).toEqual(table(a))
  return grid(a)
}

function cellPos(view: EditorView, row: number, col: number) {
  const found = tableAt(view.state.doc.resolve(3))!
  return found.pos + 1 + found.map.map[row * found.map.width + col]!
}

function cursorIn(view: EditorView, row: number, col: number, offset = 0) {
  const pos = cellPos(view, row, col) + 1 + offset
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
}

function typeIn(view: EditorView, row: number, col: number, offset: number, text: string) {
  view.dispatch(view.state.tr.insertText(text, cellPos(view, row, col) + 1 + offset))
}

function selectCells(view: EditorView, from: [number, number], to: [number, number]) {
  const sel = CellSelection.create(view.state.doc, cellPos(view, ...from), cellPos(view, ...to))
  view.dispatch(view.state.tr.setSelection(sel))
}

const run = (
  view: EditorView,
  command: (s: EditorView['state'], d?: EditorView['dispatch']) => boolean,
) => command(view.state, view.dispatch)

describe('collaboration: tables', () => {
  it('loads rows, columns, widths and alignment', () => {
    const { a, b } = pair()
    expect(expectSame(a, b)).toEqual([
      ['城市', '人数', '备注'],
      ['上海', '12', ''],
      ['杭州', '8', ''],
    ])
    expect(table(a).rows!.map((row) => row.id)).toEqual(['r1', 'r2', 'r3'])
    expect(table(b).props.columns).toEqual([
      { id: 'x', width: 120 },
      { id: 'y' },
      { id: 'z', align: 'right' },
    ])
  })

  it('merges text typed into the same cell', () => {
    const { a, b, line } = pair()
    line.offline()
    typeIn(a, 1, 0, 2, '静安')
    typeIn(b, 1, 0, 0, '[')
    line.online()
    expect(expectSame(a, b)[1]![0]).toBe('[上海静安')
  })

  it('keeps text typed into a row that someone else moves', () => {
    const { a, b, line } = pair()
    line.offline()
    cursorIn(a, 2, 0)
    run(a, moveLines('row', -1))
    typeIn(b, 2, 2, 0, '新开')
    line.online()
    expect(expectSame(a, b)).toEqual([
      ['城市', '人数', '备注'],
      ['杭州', '8', '新开'],
      ['上海', '12', ''],
    ])
  })

  it('gives a row added by one person the column added by the other', () => {
    const { a, b, line } = pair()
    line.offline()
    cursorIn(a, 1, 2)
    run(a, insertColumn('after'))
    typeIn(a, 0, 3, 0, '负责人')
    cursorIn(b, 2, 0)
    run(b, insertRow('after'))
    typeIn(b, 3, 0, 0, '苏州')
    line.online()
    const rows = expectSame(a, b)
    expect(rows).toEqual([
      ['城市', '人数', '备注', '负责人'],
      ['上海', '12', '', ''],
      ['杭州', '8', '', ''],
      ['苏州', '', '', ''],
    ])
    // the new cell is there to type into
    typeIn(b, 3, 3, 0, '戴兜')
    expect(expectSame(a, b)[3]![3]).toBe('戴兜')
  })

  it('deletes a column even while someone types in it', () => {
    const { a, b, line } = pair()
    line.offline()
    cursorIn(a, 0, 1)
    run(a, deleteColumns)
    typeIn(b, 1, 1, 2, '人')
    typeIn(b, 1, 0, 2, '市')
    line.online()
    expect(expectSame(a, b)).toEqual([
      ['城市', '备注'],
      ['上海市', ''],
      ['杭州', ''],
    ])
  })

  it('keeps text typed into a cell merged away meanwhile, and shows it again on unmerge', async () => {
    const { a, b, line } = pair()
    line.offline()
    selectCells(a, [1, 1], [2, 2])
    run(a, mergeCells)
    typeIn(b, 2, 2, 0, '待定')
    line.online()
    expect(expectSame(a, b)[1]![1]).toBe('12/8(2×2)')
    // the covered cell is not shown, but kept
    cursorIn(a, 1, 1)
    run(a, splitMergedCell)
    await tick()
    expect(expectSame(a, b)[2]).toEqual(['杭州', '', '待定'])
  })

  it('settles overlapping merges the same way for everyone', () => {
    const { a, b, line } = pair()
    line.offline()
    selectCells(a, [1, 0], [2, 1])
    run(a, mergeCells)
    selectCells(b, [0, 1], [1, 2])
    run(b, mergeCells)
    line.online()
    const rows = expectSame(a, b)
    const merged = rows.flat().filter((cell) => cell.includes('×'))
    expect(merged).toHaveLength(1)
  })

  it('shrinks a merged cell when someone deletes its last row', () => {
    const { a, b, line } = pair()
    line.offline()
    selectCells(a, [1, 0], [2, 0])
    run(a, mergeCells)
    cursorIn(b, 2, 1)
    run(b, deleteRows)
    line.online()
    expect(expectSame(a, b)).toEqual([
      ['城市', '人数', '备注'],
      ['上海/杭州', '12', ''],
    ])
  })

  it('grows a merged cell around a row inserted inside it', () => {
    const { a, b, line } = pair([
      {
        ...TABLE,
        rows: [
          { id: 'r1', cells: ['城市', '人数', '备注'] },
          { id: 'r2', cells: [{ content: '上海', rowspan: 2 }, '12', ''] },
          { id: 'r3', cells: ['', '8', ''] },
        ],
      },
    ])
    line.offline()
    cursorIn(b, 1, 1)
    run(b, insertRow('after'))
    typeIn(a, 1, 0, 2, '市')
    line.online()
    expect(expectSame(a, b).map((row) => row[0])).toEqual(['城市', '上海市(3×1)', '', ''])
  })

  it('undoes a merge, bringing the cells and their text back', () => {
    const { a, b } = pair()
    selectCells(a, [1, 0], [1, 1])
    run(a, mergeCells)
    expect(expectSame(a, b)[1]).toEqual(['上海/12(1×2)', '', ''])
    undo(a)
    expect(expectSame(a, b)[1]).toEqual(['上海', '12', ''])
  })

  it('keeps a cursor in a cell through others’ edits', () => {
    const { a, b, docA } = pair()
    const binding = { map: docA.getMap('document') } as Parameters<typeof placeOf>[0]
    const place = placeOf(binding, a.state.doc, cellPos(a, 2, 0) + 1 + 2)!
    expect(place.cell).toBe('r3:x')
    typeIn(b, 2, 0, 0, '浙江')
    cursorIn(b, 1, 0)
    run(b, moveLines('row', 1))
    expect(positionOf(binding, a.state.doc, place)).toBe(cellPos(a, 1, 0) + 1 + 4)
  })
})
