import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { collaboration, fillMap } from '..'
import { findBlockById, siblingRangeBetween } from '../../core/blocks'
import { moveRangeTo, moveRangeToNewColumn } from '../../core/commands'
import { createEditorView, getBlocks } from '../../core/editor'
import { resolveEditorExtensions } from '../../core/extension'
import type { Block, PartialBlock } from '../../core/model'
import { editorKit } from '../../extensions/editor-kit'

const views: EditorView[] = []
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(async () => {
  await tick()
  for (const view of views.splice(0)) view.destroy()
})

function client(doc: Y.Doc) {
  const kit = resolveEditorExtensions([editorKit(), collaboration({ map: doc.getMap('document') })])
  const element = document.createElement('div')
  document.body.append(element)
  const view = createEditorView({
    element,
    kit,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  views.push(view)
  return view
}

/** Two editors on one document; updates wait until `sync` (both edit "at the same time"). */
function pair(blocks: PartialBlock[]) {
  const source = new Y.Doc()
  fillMap(source.getMap('document'), { version: 1, blocks })
  const docs = [new Y.Doc(), new Y.Doc()] as const
  for (const doc of docs) Y.applyUpdate(doc, Y.encodeStateAsUpdate(source))
  const a = client(docs[0])
  const b = client(docs[1])
  const sync = () => {
    Y.applyUpdate(docs[1], Y.encodeStateAsUpdate(docs[0]))
    Y.applyUpdate(docs[0], Y.encodeStateAsUpdate(docs[1]))
  }
  return { a, b, sync }
}

const p = (id: string, text = ''): PartialBlock => ({ id, type: 'paragraph', content: text })
const START: PartialBlock[] = [
  p('a', 'before'),
  {
    id: 'r',
    type: 'columns',
    children: [
      { id: 'c1', type: 'column', children: [p('x', 'left'), p('y', 'two')] },
      { id: 'c2', type: 'column', children: [p('z', 'right')] },
    ],
  },
]

function outline(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const text = block.content.map((item) => (item.type === 'text' ? item.text : '')).join('')
      const width = block.props.width ? `(${block.props.width})` : ''
      const children = block.children.length ? `[${outline(block.children)}]` : ''
      return `${block.id}${width}:${text}${children}`
    })
    .join(' ')
}

const rangeOf = (view: EditorView, id: string) => {
  const info = findBlockById(view.state.doc, id)!
  return siblingRangeBetween(view.state.doc, info.pos + 1, info.pos + 1)!
}

function resize(view: EditorView, id: string, width: number) {
  const info = findBlockById(view.state.doc, id)!
  view.dispatch(view.state.tr.setNodeAttribute(info.contentPos, 'width', width))
}

describe('columns in collaboration', () => {
  it('a block moved to another column keeps what someone typed into it meanwhile', async () => {
    const { a, b, sync } = pair(START)
    await tick()
    const z = findBlockById(a.state.doc, 'z')!
    moveRangeTo(rangeOf(a, 'x'), z.pos)(a.state, a.dispatch)
    const x = findBlockById(b.state.doc, 'x')!
    b.dispatch(b.state.tr.insertText('!', x.contentPos + 5))
    sync()
    await tick()
    expect(outline(getBlocks(a))).toBe('a:before r:[c1:[y:two] c2:[x:left! z:right]]')
    expect(getBlocks(b)).toEqual(getBlocks(a))
  })

  it('two people resizing different columns keep both widths', async () => {
    const three: PartialBlock[] = [
      {
        id: 'r',
        type: 'columns',
        children: ['1', '2', '3'].map((n) => ({
          id: `c${n}`,
          type: 'column',
          children: [p(`x${n}`)],
        })),
      },
    ]
    const { a, b, sync } = pair(three)
    await tick()
    resize(a, 'c1', 2)
    resize(b, 'c3', 0.5)
    sync()
    await tick()
    expect(outline(getBlocks(a))).toBe('r:[c1(2):[x1:] c2:[x2:] c3(0.5):[x3:]]')
    expect(getBlocks(b)).toEqual(getBlocks(a))
  })

  it('emptying a column on one side while the other adds to it ends the same on both', async () => {
    const { a, b, sync } = pair(START)
    await tick()
    // a moves z (all of the second column) out; b adds a block to the second column
    moveRangeTo(rangeOf(a, 'z'), 0)(a.state, a.dispatch)
    const z = findBlockById(b.state.doc, 'z')!
    b.dispatch(
      b.state.tr.insert(
        z.pos + z.node.nodeSize,
        b.state.schema.nodes.block!.create({ id: 'n' }, b.state.schema.nodes.paragraph!.create()),
      ),
    )
    sync()
    await tick()
    sync()
    await tick()
    expect(getBlocks(b)).toEqual(getBlocks(a))
    // the new block is kept somewhere
    expect(outline(getBlocks(a))).toContain('n:')
  })

  it('a new column from a drop syncs', async () => {
    const { a, b, sync } = pair(START)
    await tick()
    const r = findBlockById(a.state.doc, 'r')!
    moveRangeToNewColumn(rangeOf(a, 'a'), r.pos, 2)(a.state, a.dispatch)
    sync()
    await tick()
    expect(outline(getBlocks(b))).toMatch(
      /^r:\[c1:\[x:left y:two\] c2:\[z:right\] [^:]+:\[a:before\]\]$/,
    )
    expect(getBlocks(b)).toEqual(getBlocks(a))
  })
})
