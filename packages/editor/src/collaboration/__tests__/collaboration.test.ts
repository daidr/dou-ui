import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { collaboration, fillFragment } from '..'
import { findBlockById } from '../../core/blocks'
import { moveBlocks, splitBlock } from '../../core/commands'
import { createEditorView, getBlocks } from '../../core/editor'
import { resolveExtensions } from '../../core/extension'
import { shape } from '../../core/__tests__/helpers'
import { starterKit } from '../../extensions/starter-kit'

const views: EditorView[] = []

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(async () => {
  // cursor updates are dispatched on the next tick
  await tick()
  for (const view of views.splice(0)) view.destroy()
})

/** A client: its own Y.Doc and an editor bound to it. */
function client(doc = new Y.Doc(), awareness?: Awareness) {
  const kit = resolveExtensions([
    starterKit(),
    collaboration({
      fragment: doc.getXmlFragment('document'),
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

/** Relay updates between two docs, like a server would; `online` can cut the line. */
function connect(a: Y.Doc, b: Y.Doc) {
  const line = { online: true }
  const pending: [Y.Doc, Uint8Array][] = []
  const relay = (from: Y.Doc, to: Y.Doc) =>
    from.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'relay') return
      if (line.online) Y.applyUpdate(to, update, 'relay')
      else pending.push([to, update])
    })
  relay(a, b)
  relay(b, a)
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'relay')
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b), 'relay')
  return {
    offline: () => (line.online = false),
    online: () => {
      line.online = true
      for (const [to, update] of pending.splice(0)) Y.applyUpdate(to, update, 'relay')
    },
  }
}

function seeded() {
  const source = new Y.Doc()
  fillFragment(source.getXmlFragment('document'), [
    { id: 'a', content: 'Hello' },
    { id: 'b', type: 'bulletItem', content: 'one' },
    { id: 'c', type: 'bulletItem', content: 'two' },
  ])
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  Y.applyUpdate(docA, Y.encodeStateAsUpdate(source))
  Y.applyUpdate(docB, Y.encodeStateAsUpdate(source))
  const a = client(docA)
  const b = client(docB)
  const line = connect(docA, docB)
  return { a, b, line }
}

function typeAt(view: EditorView, id: string, offset: number, text: string) {
  const block = findBlockById(view.state.doc, id)!
  const pos = block.contentPos + 1 + offset
  view.dispatch(view.state.tr.insertText(text, pos))
}

function placeCursor(view: EditorView, id: string, offset: number) {
  const block = findBlockById(view.state.doc, id)!
  const pos = block.contentPos + 1 + offset
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
}

const blocksOf = (view: EditorView) => getBlocks(view)

describe('collaboration', () => {
  it('loads the shared document, ids included', () => {
    const { a, b } = seeded()
    expect(blocksOf(a.view).map((block) => block.id)).toEqual(['a', 'b', 'c'])
    expect(blocksOf(b.view)).toEqual(blocksOf(a.view))
  })

  it('merges text typed at the same time', () => {
    const { a, b, line } = seeded()
    line.offline()
    typeAt(a.view, 'a', 5, ' 戴兜')
    typeAt(b.view, 'a', 0, '>')
    line.online()
    expect(shape(blocksOf(a.view))[0]).toEqual(['paragraph', '>Hello 戴兜'])
    expect(blocksOf(b.view)).toEqual(blocksOf(a.view))
  })

  it('keeps ids unique when both split blocks', () => {
    const { a, b, line } = seeded()
    line.offline()
    placeCursor(a.view, 'a', 2)
    splitBlock(a.view.state, a.view.dispatch)
    placeCursor(b.view, 'b', 1)
    splitBlock(b.view.state, b.view.dispatch)
    line.online()
    const blocks = blocksOf(a.view)
    expect(shape(blocks)).toEqual([
      ['paragraph', 'He'],
      ['paragraph', 'llo'],
      ['bulletItem', 'o'],
      ['bulletItem', 'ne'],
      ['bulletItem', 'two'],
    ])
    expect(new Set(blocks.map((block) => block.id)).size).toBe(5)
    expect(blocksOf(b.view)).toEqual(blocks)
  })

  // Yjs has no move: a moved block is written as changed neighbours, so an edit made
  // meanwhile in the old place can land in the block that took its place.
  it('converges, without losing text, when one moves a block another edits', () => {
    const { a, b, line } = seeded()
    line.offline()
    placeCursor(a.view, 'c', 0)
    moveBlocks(-1)(a.view.state, a.view.dispatch)
    expect(blocksOf(a.view).map((block) => block.id)).toEqual(['a', 'c', 'b'])
    typeAt(b.view, 'c', 3, '!')
    line.online()
    expect(blocksOf(b.view)).toEqual(blocksOf(a.view))
    const texts = shape(blocksOf(a.view)).map((entry) => entry[1])
    expect(texts.join('')).toHaveLength('Helloonetwo!'.length)
    expect(texts.join('')).toContain('!')
  })

  it('undoes only the own changes', () => {
    const { a, b } = seeded()
    typeAt(a.view, 'a', 5, ' A')
    typeAt(b.view, 'b', 3, ' B')
    a.kit.history!.undo(a.view.state, a.view.dispatch)
    expect(shape(blocksOf(b.view)).slice(0, 2)).toEqual([
      ['paragraph', 'Hello'],
      ['bulletItem', 'one B'],
    ])
    a.kit.history!.redo(a.view.state, a.view.dispatch)
    expect(shape(blocksOf(b.view))[0]).toEqual(['paragraph', 'Hello A'])
  })

  it('starts from an empty shared document', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    connect(docA, docB)
    const a = client(docA)
    const b = client(docB)
    expect(shape(blocksOf(a.view))).toEqual([['paragraph', '']])
    a.view.dispatch(a.view.state.tr.insertText('hi', 2))
    expect(shape(blocksOf(b.view))).toEqual([['paragraph', 'hi']])
    expect(blocksOf(b.view)[0]!.id).toBe(blocksOf(a.view)[0]!.id)
  })

  it('shows the others’ cursors with their names', async () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    fillFragment(docA.getXmlFragment('document'), [{ id: 'a', content: 'Hello' }])
    connect(docA, docB)
    const awarenessA = new Awareness(docA)
    const awarenessB = new Awareness(docB)
    const a = client(docA, awarenessA)
    client(docB, awarenessB)
    // relay B's awareness to A
    awarenessB.setLocalStateField('cursor', null)
    const relay = () => {
      const state = awarenessB.getLocalState()
      awarenessA.getStates().set(docB.clientID, state!)
      awarenessA.emit('change', [{ added: [], updated: [docB.clientID], removed: [] }, 'remote'])
    }
    const b = views[1]!
    b.focus()
    placeCursor(b, 'a', 2)
    relay()
    await tick()
    const label = a.view.dom.querySelector('.dou-editor__cursor-label')
    expect(label?.textContent).toBe(`user ${docB.clientID}`)
  })
})
