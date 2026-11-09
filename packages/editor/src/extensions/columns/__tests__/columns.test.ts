import { TextSelection, type Command, type EditorState } from 'prosemirror-state'
import { describe, expect, it } from 'vitest'
import { findBlockById, siblingRangeBetween } from '../../../core/blocks'
import {
  joinBackward,
  joinForward,
  liftBlocks,
  moveRangeTo,
  moveRangeToNewColumn,
  setBlockType,
  sinkBlocks,
  splitBlock,
} from '../../../core/commands'
import { blocksToHTML, htmlToBlocks } from '../../../core/convert'
import { docToBlocks, type PartialBlock } from '../../../core/model'
import { at, cursor, p, shapeOf, stateOf } from '../../../core/__tests__/helpers'
import { blocksToMarkdown } from '../../../markdown'
import { editorKit } from '../../editor-kit'

/** Run a command the way the view does, with the plugins' follow-up changes. */
function run(state: EditorState, command: Command) {
  let next = state
  const ok = command(state, (tr) => {
    next = state.applyTransaction(tr).state
  })
  return { ok, state: next }
}

const column = (id: string, children: PartialBlock[], width?: number): PartialBlock => ({
  id,
  type: 'column',
  props: width ? { width } : {},
  children,
})

const row = (id: string, columns: PartialBlock[]): PartialBlock => ({
  id,
  type: 'columns',
  children: columns,
})

const TWO: PartialBlock[] = [
  p('a', 'before'),
  row('r', [column('c1', [p('x', 'left'), p('y', 'more')]), column('c2', [p('z', 'right')])]),
  p('b', 'after'),
]

/** Apply a change to the document through a transaction, so the plugins fix it up. */
function change(state: EditorState, edit: (tr: EditorState['tr']) => void) {
  const tr = state.tr
  edit(tr)
  return state.applyTransaction(tr).state
}

describe('inserting columns', () => {
  it('turns an empty paragraph into columns, each with an empty paragraph, and a paragraph below', () => {
    const state = at(stateOf([p('a', 'text'), p('b')]), 'b')
    const { ok, state: next } = run(state, setBlockType('columns', { count: 3 }))
    expect(ok).toBe(true)
    expect(shapeOf(next)).toEqual([
      ['paragraph', 'text'],
      [
        'columns',
        '',
        [
          ['column', '', [['paragraph', '']]],
          ['column', '', [['paragraph', '']]],
          ['column', '', [['paragraph', '']]],
        ],
      ],
      ['paragraph', ''],
    ])
    // the cursor goes into the first column
    const blocks = docToBlocks(next.doc)
    expect(cursor(next).id).toBe(blocks[1]!.children[0]!.children[0]!.id)
  })

  it('goes after a block with text, with no extra paragraph when one follows', () => {
    const state = at(stateOf([p('a', 'text'), p('b', 'next')]), 'a', 2)
    const { state: next } = run(state, setBlockType('columns', { count: 2 }))
    expect(shapeOf(next).map(([type]) => type)).toEqual(['paragraph', 'columns', 'paragraph'])
    expect(shapeOf(next)[2]).toEqual(['paragraph', 'next'])
  })

  it('keeps the count between two and five', () => {
    const state = at(stateOf([p('a')]), 'a')
    const many = run(state, setBlockType('columns', { count: 9 })).state
    expect(docToBlocks(many.doc)[0]!.children).toHaveLength(5)
    const one = run(state, setBlockType('columns', { count: 1 })).state
    expect(docToBlocks(one.doc)[0]!.children).toHaveLength(2)
  })

  it('never turns columns into text', () => {
    const state = at(stateOf(TWO), 'a', 0, 'b', 0)
    const { state: next } = run(state, setBlockType('heading', { level: 1 }))
    expect(shapeOf(next).map(([type]) => type)).toEqual(['heading', 'columns', 'heading'])
    expect(docToBlocks(next.doc)[1]!.children.map((block) => block.type)).toEqual([
      'column',
      'column',
    ])
  })
})

describe('keeping columns well formed', () => {
  it('drops a column whose last block leaves, and the set when one column is left', () => {
    const state = stateOf(TWO)
    const z = findBlockById(state.doc, 'z')!
    const next = change(state, (tr) => {
      // z moves out of the second column, to the end of the document
      tr.insert(state.doc.content.size, z.node)
      tr.delete(z.pos - 1, z.pos + z.node.nodeSize + 1)
    })
    // the first column's blocks take the place of the set
    expect(docToBlocks(next.doc).map((block) => block.id)).toEqual(['a', 'x', 'y', 'b', 'z'])
  })

  it('keeps three columns as two when one empties', () => {
    const state = stateOf([
      row('r', [column('c1', [p('x')]), column('c2', [p('y')]), column('c3', [p('z')])]),
    ])
    const y = findBlockById(state.doc, 'y')!
    const next = change(state, (tr) => tr.delete(y.pos - 1, y.pos + y.node.nodeSize + 1))
    const blocks = docToBlocks(next.doc)
    expect(blocks[0]!.children.map((block) => block.id)).toEqual(['c1', 'c3'])
  })

  it('puts a block that lands between columns into the column before it', () => {
    const state = stateOf(TWO)
    const c2 = findBlockById(state.doc, 'c2')!
    const next = change(state, (tr) =>
      tr.insert(
        c2.pos,
        state.schema.nodes.block!.create({ id: 'n' }, state.schema.nodes.paragraph!.create()),
      ),
    )
    const blocks = docToBlocks(next.doc)
    expect(blocks[1]!.children.map((block) => block.id)).toEqual(['c1', 'c2'])
    expect(blocks[1]!.children[0]!.children.map((block) => block.id)).toEqual(['x', 'y', 'n'])
  })

  it('unwraps a column outside a set of columns', () => {
    const state = stateOf([p('a'), column('c', [p('x', 'one'), p('y', 'two')])])
    // the next change to the blocks fixes it
    const fixed = change(state, (tr) => {
      const a = findBlockById(tr.doc, 'a')!
      tr.delete(a.pos, a.pos + a.node.nodeSize)
    })
    expect(docToBlocks(fixed.doc).map((block) => block.id)).toEqual(['x', 'y'])
  })

  it('removes a set with no column left', () => {
    const state = stateOf([p('a'), ...TWO.slice(1)])
    const c1 = findBlockById(state.doc, 'c1')!
    const next = change(state, (tr) => tr.delete(c1.pos, c1.pos + c1.node.nodeSize))
    // one column was left: its blocks stay
    expect(docToBlocks(next.doc).map((block) => block.id)).toEqual(['a', 'z', 'b'])
  })
})

describe('editing in columns', () => {
  it('Backspace at the start of a column keeps the text in it', () => {
    const state = at(stateOf(TWO), 'z')
    const { ok, state: next } = run(state, joinBackward)
    expect(ok).toBe(true)
    expect(next.doc.eq(state.doc)).toBe(true)
  })

  it('Backspace in an empty column removes it and goes back to the column before', () => {
    const blocks = [
      row('r', [
        column('c1', [p('x', 'left')]),
        column('c2', [p('y')]),
        column('c3', [p('z', 'r')]),
      ]),
    ]
    const state = at(stateOf(blocks), 'y')
    const { state: next } = run(state, joinBackward)
    expect(docToBlocks(next.doc)[0]!.children.map((block) => block.id)).toEqual(['c1', 'c3'])
    expect(cursor(next)).toEqual({ id: 'x', offset: 4 })
  })

  it('Backspace after the columns joins the last block of the last column', () => {
    const state = at(stateOf(TWO), 'b')
    const { state: next } = run(state, joinBackward)
    expect(docToBlocks(next.doc)[1]!.children[1]!.children[0]!.content).toEqual([
      { type: 'text', text: 'rightafter' },
    ])
  })

  it('Delete at the end of a column, or right before columns, changes nothing', () => {
    const end = at(stateOf(TWO), 'y', 4)
    expect(run(end, joinForward).ok).toBe(true)
    expect(run(end, joinForward).state.doc.eq(end.doc)).toBe(true)
    const before = at(stateOf(TWO), 'a', 6)
    expect(run(before, joinForward).state.doc.eq(before.doc)).toBe(true)
  })

  it('Tab nests within a column but not into a set of columns; Shift+Tab stays in the column', () => {
    const second = at(stateOf(TWO), 'y')
    const nested = run(second, sinkBlocks).state
    expect(docToBlocks(nested.doc)[1]!.children[0]!.children[0]!.children[0]!.id).toBe('y')
    expect(run(at(stateOf(TWO), 'x'), sinkBlocks).ok).toBe(false)
    expect(run(at(stateOf(TWO), 'b'), sinkBlocks).ok).toBe(false)
    expect(run(at(stateOf(TWO), 'x'), liftBlocks).ok).toBe(false)
    // a nested block comes back up to the column's level
    expect(shapeOf(run(nested, liftBlocks).state)).toEqual(shapeOf(stateOf(TWO)))
  })

  it('Enter in an empty paragraph of a column adds one below instead of leaving', () => {
    const blocks = [row('r', [column('c1', [p('x')]), column('c2', [p('z')])])]
    const { state: next } = run(at(stateOf(blocks), 'x'), splitBlock)
    expect(docToBlocks(next.doc)[0]!.children[0]!.children).toHaveLength(2)
  })

  it('a selection across columns takes the whole set', () => {
    const state = stateOf(TWO)
    const x = findBlockById(state.doc, 'x')!
    const z = findBlockById(state.doc, 'z')!
    const range = siblingRangeBetween(state.doc, x.contentPos + 1, z.contentPos + 1)!
    expect(range.from).toBe(1)
    expect(range.to).toBe(1)
    expect(range.parent.child(1).attrs.id).toBe('r')
  })
})

const rangeOf = (state: EditorState, id: string) => {
  const info = findBlockById(state.doc, id)!
  return siblingRangeBetween(state.doc, info.pos + 1, info.pos + 1)!
}

describe('moving blocks between columns', () => {
  it('moves a block into another column', () => {
    const state = stateOf(TWO)
    const z = findBlockById(state.doc, 'z')!
    const { ok, state: next } = run(state, moveRangeTo(rangeOf(state, 'x'), z.pos))
    expect(ok).toBe(true)
    const columns = docToBlocks(next.doc)[1]!.children
    expect(columns.map((c) => c.children.map((block) => block.id))).toEqual([['y'], ['x', 'z']])
  })

  it('makes a new column beside the others, as wide as them on average', () => {
    const blocks = [p('a', 'out'), row('r', [column('c1', [p('x')], 2), column('c2', [p('z')])])]
    const state = stateOf(blocks)
    const r = findBlockById(state.doc, 'r')!
    const { ok, state: next } = run(state, moveRangeToNewColumn(rangeOf(state, 'a'), r.pos, 1))
    expect(ok).toBe(true)
    const columns = docToBlocks(next.doc)[0]!.children
    expect(columns.map((c) => c.children.map((block) => block.id))).toEqual([['x'], ['a'], ['z']])
    expect(columns[1]!.props.width).toBe(1.5)
  })

  it('moving a column’s only block to a new column keeps the count', () => {
    const state = stateOf([
      row('r', [column('c1', [p('x')]), column('c2', [p('y')]), column('c3', [p('z')])]),
    ])
    const r = findBlockById(state.doc, 'r')!
    const { state: next } = run(state, moveRangeToNewColumn(rangeOf(state, 'x'), r.pos, 3))
    const columns = docToBlocks(next.doc)[0]!.children
    expect(columns.map((c) => c.children.map((block) => block.id))).toEqual([['y'], ['z'], ['x']])
  })

  it('refuses a sixth column, and the set itself', () => {
    const five = [1, 2, 3, 4, 5].map((n) => column(`c${n}`, [p(`x${n}`)]))
    const state = stateOf([p('a'), row('r', five)])
    const r = findBlockById(state.doc, 'r')!
    expect(moveRangeToNewColumn(rangeOf(state, 'a'), r.pos, 0)(state)).toBe(false)
    // within the set, a whole column moving is fine
    expect(moveRangeToNewColumn(rangeOf(state, 'x1'), r.pos, 5)(state)).toBe(true)
    expect(moveRangeToNewColumn(rangeOf(state, 'r'), r.pos, 0)(state)).toBe(false)
  })
})

describe('columns in HTML and Markdown', () => {
  const extensions = [editorKit()]
  const blocks = [row('r', [column('c1', [p('x', 'left')], 2), column('c2', [p('z', 'right')])])]

  it('writes a flex row and reads it back', () => {
    const html = blocksToHTML(blocks, extensions)
    expect(html).toBe(
      '<div data-columns style="display: flex; gap: 2em"><div data-column data-width="2" style="flex: 2 1 0; min-width: 0"><p>left</p></div><div data-column style="flex: 1 1 0; min-width: 0"><p>right</p></div></div>',
    )
    const back = htmlToBlocks(html, extensions)
    expect(back[0]!.type).toBe('columns')
    expect(back[0]!.children.map((c) => [c.type, c.props, c.children[0]!.content])).toEqual([
      ['column', { width: 2 }, [{ type: 'text', text: 'left' }]],
      ['column', {}, [{ type: 'text', text: 'right' }]],
    ])
  })

  it('writes the blocks one after another in Markdown', () => {
    expect(blocksToMarkdown(blocks, extensions)).toBe('left\n\nright\n')
  })
})

describe('the selection API', () => {
  it('a text selection from one column to the next is fixed up after deleting it', () => {
    const state = stateOf(TWO)
    const x = findBlockById(state.doc, 'x')!
    const z = findBlockById(state.doc, 'z')!
    const selected = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, x.contentPos + 3, z.contentPos + 2)),
    )
    const next = selected.applyTransaction(selected.tr.deleteSelection()).state
    // whatever the deletion joined, columns stay columns: list what is wrong
    const problems: string[] = []
    const check = (list: ReturnType<typeof docToBlocks>, inRow = false): void => {
      for (const block of list) {
        if (block.type === 'column' && !inRow) problems.push(`${block.id} outside a row`)
        if (block.type === 'columns' && block.children.length < 2)
          problems.push(`${block.id} has one column`)
        if (block.type === 'column' && !block.children.length) problems.push(`${block.id} is empty`)
        if (inRow && block.type !== 'column') problems.push(`${block.id} in a row`)
        check(block.children, block.type === 'columns')
      }
    }
    check(docToBlocks(next.doc))
    expect(problems).toEqual([])
  })
})
