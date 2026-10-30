import { describe, expect, it } from 'vitest'
import { docToBlocks } from '../model'
import {
  duplicateBlocks,
  joinBackward,
  joinForward,
  liftBlocks,
  moveBlocks,
  setBlockType,
  sinkBlocks,
  splitBlock,
} from '../commands'
import { at, cursor, p, run, shapeOf, stateOf } from './helpers'

describe('splitBlock', () => {
  it('splits a paragraph at the cursor into two blocks with different ids', () => {
    const state = at(stateOf([p('a', 'HelloWorld')]), 'a', 5)
    const { state: next } = run(state, splitBlock)
    expect(shapeOf(next)).toEqual([
      ['paragraph', 'Hello'],
      ['paragraph', 'World'],
    ])
    const [first, second] = docToBlocks(next.doc)
    expect(first!.id).toBe('a')
    expect(second!.id).not.toBe('a')
    expect(second!.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(cursor(next)).toEqual({ id: second!.id, offset: 0 })
  })

  it('continues lists and to-dos, unticked', () => {
    const state = at(
      stateOf([{ id: 'a', type: 'checkItem', props: { checked: true }, content: 'Done' }]),
      'a',
      4,
    )
    const next = run(state, splitBlock).state
    const blocks = docToBlocks(next.doc)
    expect(blocks.map((block) => [block.type, block.props.checked])).toEqual([
      ['checkItem', true],
      ['checkItem', false],
    ])
  })

  it('turns a heading into a paragraph below', () => {
    const state = at(
      stateOf([{ id: 'a', type: 'heading', props: { level: 2 }, content: 'Title' }]),
      'a',
      5,
    )
    expect(shapeOf(run(state, splitBlock).state)).toEqual([
      ['heading', 'Title'],
      ['paragraph', ''],
    ])
  })

  it('turns an empty list item back into a paragraph', () => {
    const state = at(stateOf([{ id: 'a', type: 'bulletItem' }]), 'a')
    expect(shapeOf(run(state, splitBlock).state)).toEqual([['paragraph', '']])
  })

  it('moves an empty nested paragraph up a level', () => {
    const state = at(stateOf([p('a', 'Parent', [p('b')])]), 'b')
    expect(shapeOf(run(state, splitBlock).state)).toEqual([
      ['paragraph', 'Parent'],
      ['paragraph', ''],
    ])
  })

  it('opens an empty block above when the cursor is at the start', () => {
    const state = at(stateOf([p('a', 'Text')]), 'a', 0)
    const next = run(state, splitBlock).state
    expect(shapeOf(next)).toEqual([
      ['paragraph', ''],
      ['paragraph', 'Text'],
    ])
    expect(cursor(next)).toEqual({ id: 'a', offset: 0 })
  })

  it('makes the new block the first child of a block with children', () => {
    const state = at(stateOf([p('a', 'Parent', [p('b', 'Child')])]), 'a', 6)
    expect(shapeOf(run(state, splitBlock).state)).toEqual([
      [
        'paragraph',
        'Parent',
        [
          ['paragraph', ''],
          ['paragraph', 'Child'],
        ],
      ],
    ])
  })
})

describe('joinBackward', () => {
  it('turns a non-paragraph into a paragraph first', () => {
    const state = at(stateOf([{ id: 'a', type: 'quote', content: 'Q' }]), 'a', 0)
    expect(shapeOf(run(state, joinBackward).state)).toEqual([['paragraph', 'Q']])
  })

  it('joins a paragraph with the block above, keeping formatting', () => {
    const state = at(
      stateOf([
        p('a', 'One'),
        { id: 'b', content: [{ type: 'text', text: 'Two', marks: ['bold'] }] },
      ]),
      'b',
    )
    const next = run(state, joinBackward).state
    const [block] = docToBlocks(next.doc)
    expect(block!.content).toEqual([
      { type: 'text', text: 'One' },
      { type: 'text', text: 'Two', marks: ['bold'] },
    ])
    expect(cursor(next)).toEqual({ id: 'a', offset: 3 })
  })

  it('joins into the last nested block above and keeps its own children', () => {
    const state = at(stateOf([p('a', 'A', [p('a1', 'A1')]), p('b', 'B', [p('b1', 'B1')])]), 'b')
    expect(shapeOf(run(state, joinBackward).state)).toEqual([
      ['paragraph', 'A', [['paragraph', 'A1B']]],
      ['paragraph', 'B1'],
    ])
  })

  it('moves a nested paragraph up a level instead of joining', () => {
    const state = at(stateOf([p('a', 'A', [p('b', 'B')])]), 'b')
    expect(shapeOf(run(state, joinBackward).state)).toEqual([
      ['paragraph', 'A'],
      ['paragraph', 'B'],
    ])
  })

  it('removes a divider above', () => {
    const state = at(stateOf([{ id: 'd', type: 'divider' }, p('b', 'B')]), 'b')
    expect(shapeOf(run(state, joinBackward).state)).toEqual([['paragraph', 'B']])
  })

  it('does nothing at the start of the document', () => {
    const state = at(stateOf([p('a', 'A')]), 'a')
    expect(run(state, joinBackward).ok).toBe(false)
  })
})

describe('joinForward', () => {
  it('pulls the next block up, children included', () => {
    const state = at(stateOf([p('a', 'A'), p('b', 'B', [p('c', 'C')])]), 'a', 1)
    expect(shapeOf(run(state, joinForward).state)).toEqual([
      ['paragraph', 'AB'],
      ['paragraph', 'C'],
    ])
  })
})

describe('indenting', () => {
  it('nests a block under the one above, and back', () => {
    const state = at(stateOf([p('a', 'A'), p('b', 'B')]), 'b', 1)
    const sunk = run(state, sinkBlocks).state
    expect(shapeOf(sunk)).toEqual([['paragraph', 'A', [['paragraph', 'B']]]])
    expect(cursor(sunk)).toEqual({ id: 'b', offset: 1 })
    const lifted = run(sunk, liftBlocks).state
    expect(shapeOf(lifted)).toEqual([
      ['paragraph', 'A'],
      ['paragraph', 'B'],
    ])
    expect(cursor(lifted)).toEqual({ id: 'b', offset: 1 })
  })

  it('cannot indent the first block', () => {
    const state = at(stateOf([p('a', 'A')]), 'a')
    expect(run(state, sinkBlocks).ok).toBe(false)
  })

  it('appends to existing children', () => {
    const state = at(stateOf([p('a', 'A', [p('a1', 'A1')]), p('b', 'B')]), 'b')
    expect(shapeOf(run(state, sinkBlocks).state)).toEqual([
      [
        'paragraph',
        'A',
        [
          ['paragraph', 'A1'],
          ['paragraph', 'B'],
        ],
      ],
    ])
  })

  it('keeps the order when lifting a block that has siblings below', () => {
    const state = at(stateOf([p('a', 'A', [p('b', 'B'), p('c', 'C')])]), 'b')
    expect(shapeOf(run(state, liftBlocks).state)).toEqual([
      ['paragraph', 'A'],
      ['paragraph', 'B', [['paragraph', 'C']]],
    ])
  })

  it('indents several selected siblings together', () => {
    const state = at(stateOf([p('a', 'A'), p('b', 'B'), p('c', 'C')]), 'b', 0, 'c', 1)
    expect(shapeOf(run(state, sinkBlocks).state)).toEqual([
      [
        'paragraph',
        'A',
        [
          ['paragraph', 'B'],
          ['paragraph', 'C'],
        ],
      ],
    ])
  })
})

describe('block types', () => {
  it('converts blocks and drops formatting a code block cannot hold', () => {
    const state = at(
      stateOf([{ id: 'a', content: [{ type: 'text', text: 'x', marks: ['bold'] }] }]),
      'a',
    )
    const heading = run(state, setBlockType('heading', { level: 2 })).state
    expect(docToBlocks(heading.doc)[0]).toMatchObject({ type: 'heading', props: { level: 2 } })
    const code = run(heading, setBlockType('codeBlock')).state
    expect(docToBlocks(code.doc)[0]).toMatchObject({
      type: 'codeBlock',
      content: [{ type: 'text', text: 'x' }],
    })
  })

  it('turns a block into a divider with a paragraph to continue in', () => {
    const state = at(stateOf([p('a')]), 'a')
    const next = run(state, setBlockType('divider')).state
    expect(shapeOf(next)).toEqual([
      ['divider', ''],
      ['paragraph', ''],
    ])
    expect(next.selection.$from.parent.type.name).toBe('paragraph')
  })
})

describe('moving and duplicating', () => {
  it('swaps a block with its neighbour', () => {
    const state = at(stateOf([p('a', 'A'), p('b', 'B'), p('c', 'C')]), 'b', 1)
    const up = run(state, moveBlocks(-1)).state
    expect(shapeOf(up)).toEqual([
      ['paragraph', 'B'],
      ['paragraph', 'A'],
      ['paragraph', 'C'],
    ])
    expect(cursor(up)).toEqual({ id: 'b', offset: 1 })
    const down = run(state, moveBlocks(1)).state
    expect(shapeOf(down)).toEqual([
      ['paragraph', 'A'],
      ['paragraph', 'C'],
      ['paragraph', 'B'],
    ])
    expect(run(at(state, 'a'), moveBlocks(-1)).ok).toBe(false)
  })

  it('duplicates blocks with fresh ids', () => {
    const state = at(stateOf([p('a', 'A', [p('b', 'B')])]), 'a')
    const next = run(state, duplicateBlocks).state
    const blocks = docToBlocks(next.doc)
    expect(shapeOf(next)).toEqual([
      ['paragraph', 'A', [['paragraph', 'B']]],
      ['paragraph', 'A', [['paragraph', 'B']]],
    ])
    const ids = [
      blocks[0]!.id,
      blocks[0]!.children[0]!.id,
      blocks[1]!.id,
      blocks[1]!.children[0]!.id,
    ]
    expect(new Set(ids).size).toBe(4)
  })
})
