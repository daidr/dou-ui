// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { fillMap, readMap, updateMap } from '..'
import type { EditorDocument, PartialBlock } from '../../core/model'
import { editorKit } from '../../extensions/editor-kit'
import { boardOf, flowBlock, whiteboardBlock } from '../../flow'

const documentOf = (block: PartialBlock): EditorDocument<PartialBlock> => ({
  version: 1,
  blocks: [block],
})
const extensions = [editorKit(), whiteboardBlock(), flowBlock({ type: 'flow', label: '流程' })]
const options = { extensions }
const initialBoard = () => ({
  version: 1,
  nodes: [
    { id: 'a', type: 'shape', x: 0, y: 0, data: { text: '甲', color: 'gray' } },
    { id: 'b', type: 'shape', x: 200, y: 0, data: { text: '发货' } },
  ],
  edges: [{ id: 'e', source: { node: 'a' }, target: { node: 'b' } }],
})
const setup = (block: PartialBlock) => {
  const doc = new Y.Doc()
  const map = doc.getMap('document')
  fillMap(map, documentOf(block), options)
  const base = readMap(map, options)
  return { map, base, read: () => readMap(map, options).blocks[0]! }
}
const plain = (block: { content: unknown }) =>
  (block.content as { text?: string }[]).map((part) => part.text ?? '').join('')

describe('updateMap writes from its base inside a changed block', () => {
  it.each(['whiteboard', 'flow'])(
    'keeps other node fields, data keys, additions and deletions in %s',
    (type) => {
      const { map, base, read } = setup({
        id: 'w',
        type,
        props: { board: initialBoard(), height: 360 },
      })
      const current = initialBoard()
      current.nodes[0]!.x = 500
      current.nodes[0]!.data.color = 'red'
      current.nodes.push({ id: 'c', type: 'shape', x: 400, y: 0, data: { text: '新增' } })
      current.edges = []
      updateMap(map, documentOf({ id: 'w', type, props: { board: current, height: 420 } }), options)
      const written = initialBoard()
      written.nodes[0]!.y = 50
      written.nodes[0]!.data.text = '甲改'
      written.nodes[1]!.data.text = '安排发货'
      updateMap(map, documentOf({ id: 'w', type, props: { board: written, height: 360 } }), {
        ...options,
        base,
      })
      const result = boardOf(read().props.board)
      expect(result.nodes[0]).toMatchObject({ x: 500, y: 50, data: { color: 'red', text: '甲改' } })
      expect(result.nodes[1]!.data!.text).toBe('安排发货')
      expect(result.nodes.some((node) => node.id === 'c')).toBe(true)
      expect(result.edges).toEqual([])
      expect(read().props.height).toBe(420)
    },
  )

  it('keeps a node deleted since base deleted, even when written changes it', () => {
    const { map, base, read } = setup({
      id: 'w',
      type: 'whiteboard',
      props: { board: initialBoard() },
    })
    const current = initialBoard()
    current.nodes.splice(0, 1)
    current.edges = []
    updateMap(map, documentOf({ id: 'w', type: 'whiteboard', props: { board: current } }), options)
    const written = initialBoard()
    written.nodes[0]!.x = 80
    written.nodes[1]!.data.text = '安排发货'
    updateMap(map, documentOf({ id: 'w', type: 'whiteboard', props: { board: written } }), {
      ...options,
      base,
    })
    expect(boardOf(read().props.board).nodes.map((node) => node.id)).toEqual(['b'])
  })

  it.each([
    ['alpha beta gamma', 'USER alpha beta gamma', 'alpha beta gamma!', 'USER alpha beta gamma!'],
    ['alpha beta gamma', 'alpha beta USER gamma', 'ALPHA beta gamma', 'ALPHA beta USER gamma'],
    ['alpha beta gamma', 'alpha gamma', 'alpha beta gamma!', 'alpha gamma!'],
    ['abc def ghi jkl', 'Aabc def ghi jklZ', 'abc DEF ghi jkl', 'Aabc DEF ghi jklZ'],
    [
      'alpha beta gamma delta',
      'alpha beta ROOM gamma delta',
      'ALPHA beta gamma DELTA',
      'ALPHA beta ROOM gamma DELTA',
    ],
    ['甲乙丙丁', '前甲乙丙丁后', '甲乙改丙丁', '前甲乙改丙丁后'],
    ['alpha beta gamma', 'alpha USER gamma', 'alpha AI gamma', 'alpha AI gamma'],
  ])('rebases inline changes: %s → %s / %s', (initial, current, written, expected) => {
    const { map, base, read } = setup({ id: 'p', content: initial })
    updateMap(map, documentOf({ id: 'p', content: current }), options)
    updateMap(map, documentOf({ id: 'p', content: written }), { ...options, base })
    expect(plain(read())).toBe(expected)
  })

  it('keeps plain props changed only in the room when text is written', () => {
    const { map, base, read } = setup({
      id: 'p',
      type: 'heading',
      props: { level: 1 },
      content: '标题',
    })
    updateMap(
      map,
      documentOf({ id: 'p', type: 'heading', props: { level: 2 }, content: '标题' }),
      options,
    )
    updateMap(
      map,
      documentOf({ id: 'p', type: 'heading', props: { level: 1 }, content: '新标题' }),
      { ...options, base },
    )
    expect(read().props.level).toBe(2)
    expect(plain(read())).toBe('新标题')
  })

  it('keeps a room cell edit and column width while writing another cell', () => {
    const table: PartialBlock = {
      id: 't',
      type: 'table',
      props: { columns: [{ id: 'x', width: 120 }, { id: 'y' }] },
      rows: [{ id: 'r', cells: ['alpha beta', 'second'] }],
    }
    const { map, base, read } = setup(table)
    updateMap(
      map,
      documentOf({
        ...table,
        props: { columns: [{ id: 'x', width: 180 }, { id: 'y' }] },
        rows: [{ id: 'r', cells: ['USER alpha beta', 'second'] }],
      }),
      options,
    )
    updateMap(
      map,
      documentOf({ ...table, rows: [{ id: 'r', cells: ['alpha beta!', 'second edited'] }] }),
      { ...options, base },
    )
    expect(read().props.columns).toEqual([{ id: 'x', width: 180 }, { id: 'y' }])
    const cells = read().rows![0]!.cells
    expect(
      cells.map((cell) =>
        cell.content.map((part) => (part.type === 'text' ? part.text : '')).join(''),
      ),
    ).toEqual(['USER alpha beta!', 'second edited'])
  })

  it('keeps remote formatting while writing text and preserves remote text while formatting', () => {
    const { map, base, read } = setup({ id: 'p', content: 'alpha beta' })
    updateMap(
      map,
      documentOf({
        id: 'p',
        content: [{ type: 'text', text: 'USER alpha beta', marks: ['italic'] }],
      }),
      options,
    )
    updateMap(
      map,
      documentOf({ id: 'p', content: [{ type: 'text', text: 'alpha beta', marks: ['bold'] }] }),
      { ...options, base },
    )
    expect(plain(read())).toBe('USER alpha beta')
    expect(read().content).toEqual([
      { type: 'text', text: 'USER ', marks: ['italic'] },
      { type: 'text', text: 'alpha beta', marks: ['bold', 'italic'] },
    ])
  })

  it('keeps a room node order when written only edits a field', () => {
    const { map, base, read } = setup({
      id: 'w',
      type: 'whiteboard',
      props: { board: initialBoard() },
    })
    const current = initialBoard()
    current.nodes.reverse()
    updateMap(map, documentOf({ id: 'w', type: 'whiteboard', props: { board: current } }), options)
    const written = initialBoard()
    written.nodes[0]!.data.text = '甲改'
    updateMap(map, documentOf({ id: 'w', type: 'whiteboard', props: { board: written } }), {
      ...options,
      base,
    })
    const result = boardOf(read().props.board)
    expect(result.nodes.map((node) => node.id)).toEqual(['b', 'a'])
    expect(result.nodes[1]!.data!.text).toBe('甲改')
  })

  it('does not recreate a table row deleted in the room', () => {
    const table: PartialBlock = {
      id: 't',
      type: 'table',
      props: { columns: [{ id: 'x' }] },
      rows: [
        { id: 'a', cells: ['first'] },
        { id: 'b', cells: ['second'] },
      ],
    }
    const { map, base, read } = setup(table)
    updateMap(map, documentOf({ ...table, rows: [{ id: 'b', cells: ['second'] }] }), options)
    updateMap(
      map,
      documentOf({
        ...table,
        rows: [
          { id: 'a', cells: ['first!'] },
          { id: 'b', cells: ['second!'] },
        ],
      }),
      { ...options, base },
    )
    expect(read().rows!.map((row) => row.id)).toEqual(['b'])
  })

  it('uses current content as the baseline when the block type changes', () => {
    const { map, base, read } = setup({ id: 'p', content: '正文' })
    updateMap(map, documentOf({ id: 'p', content: '房间正文' }), options)
    updateMap(map, documentOf({ id: 'p', type: 'heading', props: { level: 2 }, content: '标题' }), {
      ...options,
      base,
    })
    expect(read()).toMatchObject({ type: 'heading', props: { level: 2 } })
    expect(plain(read())).toBe('标题')
  })
})
