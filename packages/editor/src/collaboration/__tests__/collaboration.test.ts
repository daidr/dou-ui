import { mount } from '@vue/test-utils'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { collaboration, fillMap } from '..'
import { findBlockById } from '../../core/blocks'
import { liftBlocks, sinkBlocks, splitBlock } from '../../core/commands'
import { createEditorView, getBlocks } from '../../core/editor'
import { resolveEditorExtensions } from '../../core/extension'
import type { Block, PartialBlock } from '../../core/model'
import { applyEditorTransaction, EditorTransaction } from '../../core/transaction'
import DouEditor from '../../editor.vue'
import { editorKit } from '../../extensions/editor-kit'

const views: EditorView[] = []
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(async () => {
  await tick()
  for (const view of views.splice(0)) view.destroy()
})

/** A client: its own Y.Doc and an editor bound to it. */
function client(doc = new Y.Doc(), awareness?: Awareness) {
  const kit = resolveEditorExtensions([
    editorKit(),
    collaboration({
      map: doc.getMap('document'),
      awareness,
      user: { name: `user ${doc.clientID}` },
    }),
  ])
  const element = document.createElement('div')
  document.body.append(element)
  const view = createEditorView({
    element,
    kit,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  views.push(view)
  return { doc, view, kit }
}

/** Relay updates between two docs, like a server would; the line can be cut. */
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
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'relay')
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b), 'relay')
  return {
    offline: () => (online = false),
    online: () => {
      online = true
      for (const [to, update] of pending.splice(0)) Y.applyUpdate(to, update, 'relay')
    },
  }
}

const START: PartialBlock[] = [
  { id: 'a', content: 'Hello' },
  { id: 'b', type: 'bulletItem', content: 'one' },
  { id: 'c', type: 'bulletItem', content: 'two' },
]

/** Two clients on the same document, connected. */
function pair(blocks: PartialBlock[] = START) {
  const source = new Y.Doc()
  fillMap(source.getMap('document'), blocks)
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  Y.applyUpdate(docA, Y.encodeStateAsUpdate(source))
  Y.applyUpdate(docB, Y.encodeStateAsUpdate(source))
  const a = client(docA)
  const b = client(docB)
  const line = connect(docA, docB)
  return { a, b, line }
}

const blocksOf = (view: EditorView) => getBlocks(view)

/** `id:text` per block, children in brackets. */
function outline(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const text = block.content.map((item) => (item.type === 'text' ? item.text : '\n')).join('')
      const children = block.children.length ? `[${outline(block.children)}]` : ''
      return `${block.id}:${text}${children}`
    })
    .join(' ')
}

function expectSame(a: EditorView, b: EditorView) {
  expect(blocksOf(b)).toEqual(blocksOf(a))
  return outline(blocksOf(a))
}

function typeAt(view: EditorView, id: string, offset: number, text: string) {
  const block = findBlockById(view.state.doc, id)!
  view.dispatch(view.state.tr.insertText(text, block.contentPos + 1 + offset))
}

function placeCursor(view: EditorView, id: string, offset = 0) {
  const block = findBlockById(view.state.doc, id)!
  const pos = block.contentPos + 1 + offset
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
}

/** Move a block (with its children) before another block, as dragging does. */
function moveBefore(view: EditorView, id: string, target: string) {
  const block = findBlockById(view.state.doc, id)!
  const tr = view.state.tr.delete(block.pos, block.pos + block.node.nodeSize)
  const to = findBlockById(tr.doc, target)!
  tr.insert(to.pos, block.node)
  view.dispatch(tr)
}

function moveToEnd(view: EditorView, id: string) {
  const block = findBlockById(view.state.doc, id)!
  const tr = view.state.tr.delete(block.pos, block.pos + block.node.nodeSize)
  tr.insert(tr.doc.content.size, block.node)
  view.dispatch(tr)
}

function run(
  view: EditorView,
  command: (state: EditorView['state'], dispatch: EditorView['dispatch']) => boolean,
) {
  return command(view.state, view.dispatch)
}

describe('collaboration', () => {
  it('loads the shared document, ids included', () => {
    const { a, b } = pair()
    expect(outline(blocksOf(a.view))).toBe('a:Hello b:one c:two')
    expectSame(a.view, b.view)
  })

  it('merges text typed at the same time', () => {
    const { a, b, line } = pair()
    line.offline()
    typeAt(a.view, 'a', 5, ' 戴兜')
    typeAt(b.view, 'a', 0, '>')
    line.online()
    expect(expectSame(a.view, b.view)).toBe('a:>Hello 戴兜 b:one c:two')
  })

  it('keeps ids unique when both split blocks', () => {
    const { a, b, line } = pair()
    line.offline()
    placeCursor(a.view, 'a', 2)
    run(a.view, splitBlock)
    placeCursor(b.view, 'b', 1)
    run(b.view, splitBlock)
    line.online()
    expectSame(a.view, b.view)
    const blocks = blocksOf(a.view)
    expect(
      blocks.map((block) =>
        block.content.map((item) => (item.type === 'text' ? item.text : '')).join(''),
      ),
    ).toEqual(['He', 'llo', 'o', 'ne', 'two'])
    expect(new Set(blocks.map((block) => block.id)).size).toBe(5)
  })

  it('keeps text typed into a block that someone else moves', () => {
    const { a, b, line } = pair()
    line.offline()
    moveBefore(a.view, 'c', 'a')
    typeAt(b.view, 'c', 3, '!')
    typeAt(b.view, 'b', 0, '1. ')
    line.online()
    expect(expectSame(a.view, b.view)).toBe('c:two! a:Hello b:1. one')
  })

  it('keeps text typed into a block that someone else indents', () => {
    const { a, b, line } = pair()
    line.offline()
    placeCursor(a.view, 'c', 1)
    run(a.view, sinkBlocks)
    typeAt(b.view, 'c', 0, '>')
    line.online()
    expect(expectSame(a.view, b.view)).toBe('a:Hello b:one[c:>two]')
  })

  it('puts a block moved by two people at the same time in one place', () => {
    const { a, b, line } = pair()
    line.offline()
    moveBefore(a.view, 'c', 'a')
    moveBefore(b.view, 'c', 'b')
    line.online()
    const result = expectSame(a.view, b.view)
    expect(result.match(/c:two/g)).toHaveLength(1)
    expect(['c:two a:Hello b:one', 'a:Hello c:two b:one']).toContain(result)
  })

  it('breaks a cycle when two blocks are moved into each other', () => {
    const { a, b, line } = pair([
      { id: 'a', content: 'A' },
      { id: 'b', content: 'B' },
      { id: 'x', content: 'X' },
    ])
    line.offline()
    // A puts b under a; B puts a under b
    placeCursor(a.view, 'b')
    run(a.view, sinkBlocks)
    moveBefore(b.view, 'a', 'x')
    placeCursor(b.view, 'a')
    run(b.view, sinkBlocks)
    expect(outline(blocksOf(a.view))).toBe('a:A[b:B] x:X')
    expect(outline(blocksOf(b.view))).toBe('b:B[a:A] x:X')
    line.online()
    const result = expectSame(a.view, b.view)
    for (const id of ['a', 'b', 'x'])
      expect(result.match(new RegExp(`${id}:`, 'g'))).toHaveLength(1)
  })

  it('keeps a block moved into a block that someone else deleted', () => {
    const { a, b, line } = pair([
      { id: 'a', content: 'A' },
      { id: 'b', content: 'B' },
      { id: 'c', content: 'C' },
    ])
    line.offline()
    placeCursor(a.view, 'c')
    run(a.view, sinkBlocks)
    const target = findBlockById(b.view.state.doc, 'b')!
    b.view.dispatch(b.view.state.tr.delete(target.pos, target.pos + target.node.nodeSize))
    line.online()
    expect(expectSame(a.view, b.view)).toBe('a:A c:C')
  })

  it('places blocks inserted at the same spot one after the other', () => {
    const { a, b, line } = pair()
    line.offline()
    placeCursor(a.view, 'a', 5)
    run(a.view, splitBlock)
    a.view.dispatch(a.view.state.tr.insertText('from A'))
    placeCursor(b.view, 'a', 5)
    run(b.view, splitBlock)
    b.view.dispatch(b.view.state.tr.insertText('from B'))
    line.online()
    const result = expectSame(a.view, b.view)
    expect(result).toMatch(/^a:Hello \S+:from [AB] \S+:from [AB] b:one c:two$/)
  })

  it('merges formatting and typing in the same text', () => {
    const { a, b, line } = pair()
    line.offline()
    const block = findBlockById(a.view.state.doc, 'a')!
    a.view.dispatch(
      a.view.state.tr.addMark(
        block.contentPos + 1,
        block.contentPos + 6,
        a.view.state.schema.marks.bold!.create(),
      ),
    )
    typeAt(b.view, 'a', 2, '-')
    line.online()
    expectSame(a.view, b.view)
    expect(blocksOf(a.view)[0]!.content).toEqual([
      { type: 'text', text: 'He-llo', marks: ['bold'] },
    ])
  })

  it('syncs props, type changes and lifting', () => {
    const { a, b } = pair()
    const block = findBlockById(a.view.state.doc, 'b')!
    a.view.dispatch(
      a.view.state.tr.setNodeMarkup(block.contentPos, a.view.state.schema.nodes.checkItem, {
        checked: true,
      }),
    )
    placeCursor(a.view, 'c')
    run(a.view, sinkBlocks)
    expect(expectSame(a.view, b.view)).toBe('a:Hello b:one[c:two]')
    expect(blocksOf(b.view)[1]!.props).toEqual({ checked: true })
    placeCursor(b.view, 'c')
    run(b.view, liftBlocks)
    expect(expectSame(a.view, b.view)).toBe('a:Hello b:one c:two')
  })

  it('undoes only the own changes, moves included', () => {
    const { a, b } = pair()
    typeAt(a.view, 'a', 5, ' A')
    typeAt(b.view, 'b', 3, ' B')
    a.kit.history!.undo(a.view.state, a.view.dispatch)
    expect(expectSame(a.view, b.view)).toBe('a:Hello b:one B c:two')
    a.kit.history!.redo(a.view.state, a.view.dispatch)
    expect(expectSame(a.view, b.view)).toBe('a:Hello A b:one B c:two')
    a.kit.history!.undo(a.view.state, a.view.dispatch)
    moveToEnd(b.view, 'a')
    expect(expectSame(a.view, b.view)).toBe('b:one B c:two a:Hello')
    b.kit.history!.undo(b.view.state, b.view.dispatch)
    expect(expectSame(a.view, b.view)).toBe('a:Hello b:one B c:two')
  })

  it('undoes a transact as one step of its own, apart from typing around it', () => {
    const { a, b } = pair()
    typeAt(a.view, 'a', 5, ' A')
    const tr = new EditorTransaction(a.view.state)
    tr.updateBlock('b', { content: 'uno' })
    tr.insertBlocks([{ id: 'n', content: 'new' }], { after: 'c' })
    applyEditorTransaction(a.view, tr)
    typeAt(a.view, 'a', 7, '!')
    expect(expectSame(a.view, b.view)).toBe('a:Hello A! b:uno c:two n:new')
    a.kit.history!.undo(a.view.state, a.view.dispatch)
    expect(expectSame(a.view, b.view)).toBe('a:Hello A b:uno c:two n:new')
    a.kit.history!.undo(a.view.state, a.view.dispatch)
    expect(expectSame(a.view, b.view)).toBe('a:Hello A b:one c:two')
  })

  it('starts from an empty shared document', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    connect(docA, docB)
    const a = client(docA)
    const b = client(docB)
    expect(outline(blocksOf(a.view))).toMatch(/^\S+:$/)
    a.view.dispatch(a.view.state.tr.insertText('hi', 2))
    expect(expectSame(a.view, b.view)).toMatch(/^\S+:hi$/)
  })

  it('keeps the order through many moves without the keys growing much', () => {
    const blocks = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, content: String(i) }))
    const { a, b } = pair(blocks)
    for (let i = 0; i < 40; i++) {
      const id = `b${(i * 7) % 20}`
      moveBefore(a.view, id, id === 'b3' ? 'b4' : 'b3')
    }
    expectSame(a.view, b.view)
    const map = a.doc.getMap('document') as Y.Map<Y.Map<unknown>>
    const longest = Math.max(
      ...Array.from(map.values(), (yblock) => String(yblock.get('order')).length),
    )
    expect(longest).toBeLessThan(12)
  })

  it('shows the others’ cursors with their names', async () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    fillMap(docA.getMap('document'), [{ id: 'a', content: 'Hello' }])
    connect(docA, docB)
    const awarenessA = new Awareness(docA)
    const awarenessB = new Awareness(docB)
    const a = client(docA, awarenessA)
    const b = client(docB, awarenessB)
    b.view.focus()
    placeCursor(b.view, 'a', 2)
    // relay B's awareness to A
    awarenessA.getStates().set(docB.clientID, awarenessB.getLocalState()!)
    awarenessA.emit('change', [{ added: [], updated: [docB.clientID], removed: [] }, 'remote'])
    await tick()
    const label = a.view.dom.querySelector('.dou-editor__cursor-label')
    expect(label?.textContent).toBe(`user ${docB.clientID}`)
  })

  it('mirrors the shared document through v-model and ignores outside changes', async () => {
    const doc = new Y.Doc()
    fillMap(doc.getMap('document'), [{ id: 'a', content: 'Shared' }])
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: {
        extensions: [editorKit(), collaboration({ map: doc.getMap('document') })],
        modelValue: [{ id: 'x', content: 'Ignored' }],
      },
    })
    await nextTick()
    expect(wrapper.element.textContent).toContain('Shared')
    expect(wrapper.element.textContent).not.toContain('Ignored')
    const emitted = wrapper.emitted('update:modelValue')!.at(-1)![0] as Block[]
    expect(emitted[0]!.id).toBe('a')
    await wrapper.setProps({ modelValue: [{ id: 'y', content: 'Also ignored' }] })
    expect(wrapper.element.textContent).toContain('Shared')
    wrapper.unmount()
  })
})
