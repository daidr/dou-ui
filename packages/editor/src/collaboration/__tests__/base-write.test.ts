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

  it.each([
    ['😀abc', '😀abcZ', '😁abc', '😁abcZ'],
    ['A😀BCD', 'PRE A😀BCD', 'A😁BCD', 'PRE A😁BCD'],
  ])('does not split a surrogate pair while rebasing %s', (initial, current, written, expected) => {
    const { map, base, read } = setup({ id: 'p', content: initial })
    updateMap(map, documentOf({ id: 'p', content: current }), options)
    updateMap(map, documentOf({ id: 'p', content: written }), { ...options, base })
    expect(plain(read())).toBe(expected)
  })

  it('retains a common island after large edits on both sides', () => {
    const initial = 'a'.repeat(400) + ' KEEP ' + 'b'.repeat(400)
    const written = 'c'.repeat(400) + ' KEEP ' + 'd'.repeat(400)
    const { map, base, read } = setup({ id: 'p', content: initial })
    updateMap(map, documentOf({ id: 'p', content: initial.replace('KEEP', 'ROOM') }), options)
    updateMap(map, documentOf({ id: 'p', content: written }), { ...options, base })
    expect(plain(read())).toBe(written.replace('KEEP', 'ROOM'))
  })

  it.each([false, true])(
    'retains an unchanged comment island, with a room edit: %s',
    (roomEdit) => {
      const { map, base, read } = setup({
        id: 'p',
        content: [
          { type: 'text', text: 'aa ' },
          { type: 'text', text: 'keep', comments: ['t1'] },
          { type: 'text', text: ' zz' },
        ],
      })
      if (roomEdit) ((map.get('p') as Y.Map<unknown>).get('text') as Y.Text).insert(10, ' ROOM')
      updateMap(map, documentOf({ id: 'p', content: 'AA keep ZZ' }), { ...options, base })
      expect(plain(read())).toBe('AA keep ZZ' + (roomEdit ? ' ROOM' : ''))
      expect(read().content).toContainEqual({ type: 'text', text: 'keep', comments: ['t1'] })
    },
  )

  it('keeps the identity of text between two edits even when the room matches base', () => {
    const { map, base } = setup({ id: 'p', content: 'aa keep zz' })
    const value = (map.get('p') as Y.Map<unknown>).get('text') as Y.Text
    const position = Y.createRelativePositionFromTypeIndex(value, 4)
    updateMap(map, documentOf({ id: 'p', content: 'AA keep ZZ' }), { ...options, base })
    expect(Y.createAbsolutePositionFromRelativePosition(position, map.doc!)?.index).toBe(4)
  })

  it.each(['delete', 'add'])(
    'keeps the room board order while the writer only changes membership: %s',
    (operation) => {
      const board = initialBoard()
      board.edges = []
      board.nodes.push({ id: 'c', type: 'shape', x: 300, y: 0, data: { text: '丙' } })
      const { map, base, read } = setup({ id: 'w', type: 'whiteboard', props: { board } })
      updateMap(
        map,
        documentOf({
          id: 'w',
          type: 'whiteboard',
          props: {
            board: {
              ...board,
              nodes: board.nodes.map((_, index) => board.nodes[board.nodes.length - 1 - index]!),
            },
          },
        }),
        options,
      )
      const nodes =
        operation === 'delete'
          ? board.nodes.slice(0, 2)
          : [...board.nodes, { id: 'd', type: 'shape', x: 400, y: 0, data: { text: '丁' } }]
      updateMap(
        map,
        documentOf({ id: 'w', type: 'whiteboard', props: { board: { ...board, nodes } } }),
        { ...options, base },
      )
      const result = boardOf(read().props.board).nodes.map((node) => node.id)
      expect(result.filter((id) => id !== 'd')).toEqual(
        operation === 'delete' ? ['b', 'a'] : ['c', 'b', 'a'],
      )
    },
  )

  it.each(['delete', 'add'])(
    'keeps the room row order while the writer only changes membership: %s',
    (operation) => {
      const table: PartialBlock = {
        id: 't',
        type: 'table',
        props: { columns: [{ id: 'x' }] },
        rows: [
          { id: 'a', cells: ['a'] },
          { id: 'b', cells: ['b'] },
          { id: 'c', cells: ['c'] },
        ],
      }
      const { map, base, read } = setup(table)
      updateMap(
        map,
        documentOf({
          ...table,
          rows: table.rows!.map((_, index) => table.rows![table.rows!.length - 1 - index]!),
        }),
        options,
      )
      const rows =
        operation === 'delete'
          ? table.rows!.slice(0, 2)
          : [...table.rows!, { id: 'd', cells: ['d'] }]
      updateMap(map, documentOf({ ...table, rows }), { ...options, base })
      expect(
        read()
          .rows!.map((row) => row.id)
          .filter((id) => id !== 'd'),
      ).toEqual(operation === 'delete' ? ['b', 'a'] : ['c', 'b', 'a'])
    },
  )

  it('keeps a table-cell comment island when a Markdown write changes both ends', () => {
    const table: PartialBlock = {
      id: 't',
      type: 'table',
      props: { columns: [{ id: 'x' }] },
      rows: [
        {
          id: 'a',
          cells: [
            {
              content: [
                { type: 'text', text: 'aa ' },
                { type: 'text', text: 'keep', comments: ['t1'] },
                { type: 'text', text: ' zz' },
              ],
            },
          ],
        },
      ],
    }
    const { map, base, read } = setup(table)
    updateMap(map, documentOf({ ...table, rows: [{ id: 'a', cells: ['AA keep ZZ'] }] }), {
      ...options,
      base,
    })
    expect(read().rows![0]!.cells[0]!.content).toContainEqual({
      type: 'text',
      text: 'keep',
      comments: ['t1'],
    })
  })

  it('can unmerge after rows in a merge were reordered', () => {
    const table: PartialBlock = {
      id: 't',
      type: 'table',
      props: { columns: [{ id: 'x' }] },
      rows: [
        { id: 'a', cells: [{ content: 'a', rowspan: 2 }] },
        { id: 'b', cells: [''] },
      ],
    }
    const { map, read } = setup(table)
    updateMap(
      map,
      documentOf({
        ...table,
        rows: [
          { id: 'b', cells: [{ content: 'a', rowspan: 2 }] },
          { id: 'a', cells: [''] },
        ],
      }),
      options,
    )
    updateMap(
      map,
      documentOf({
        ...table,
        rows: [
          { id: 'b', cells: ['a'] },
          { id: 'a', cells: [''] },
        ],
      }),
      options,
    )
    expect(read().rows!.map((row) => row.cells[0]!.rowspan ?? 1)).toEqual([1, 1])
  })

  it.each(['paragraph', 'table'])(
    'rejects a comparison-limit failure before any map write: %s',
    (kind) => {
      const initial = Array.from({ length: 6000 }, (_, i) => String.fromCodePoint(0x3400 + i)).join(
        '',
      )
      const rewritten = Array.from(
        { length: initial.length },
        (_, index) => initial[initial.length - 1 - index]!,
      ).join('')
      const block: PartialBlock =
        kind === 'paragraph'
          ? { id: 'heavy', content: initial }
          : {
              id: 'heavy',
              type: 'table',
              props: { columns: [{ id: 'x' }, { id: 'y' }] },
              rows: [{ id: 'r', cells: ['first', initial] }],
            }
      const ydoc = new Y.Doc()
      const map = ydoc.getMap('document')
      fillMap(
        map,
        {
          version: 1,
          blocks: [{ id: 'first', content: 'first' }, block, { id: 'removed', content: 'last' }],
        },
        options,
      )
      const base = readMap(map, options)
      const saved = Y.encodeStateAsUpdate(ydoc)
      let updates = 0
      ydoc.on('update', () => updates++)
      const written: PartialBlock =
        kind === 'paragraph'
          ? { ...block, content: rewritten }
          : {
              ...block,
              props: { columns: [{ id: 'x', width: 200 }, { id: 'y' }] },
              rows: [{ id: 'r', cells: ['first!', rewritten] }],
            }
      expect(() =>
        updateMap(
          map,
          {
            version: 1,
            blocks: [{ id: 'first', content: 'changed' }, written, { id: 'new', content: 'new' }],
          },
          { ...options, base },
        ),
      ).toThrow(/\[@dou-ui\/editor\] updateMap cannot safely merge/)
      expect(Y.encodeStateAsUpdate(ydoc)).toEqual(saved)
      expect(updates).toBe(0)
    },
  )

  it('handles a large replacement with disjoint characters without a quadratic search', () => {
    const { map, base, read } = setup({ id: 'p', content: 'a'.repeat(50_000) })
    const start = performance.now()
    updateMap(map, documentOf({ id: 'p', content: 'b'.repeat(50_000) }), { ...options, base })
    expect(plain(read())).toBe('b'.repeat(50_000))
    expect(performance.now() - start).toBeLessThan(1000)
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
