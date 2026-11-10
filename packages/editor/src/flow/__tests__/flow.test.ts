import type { FlowDocument, FlowEditorExpose } from '@dou-ui/flow'
import { mount } from '@vue/test-utils'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, type ComponentInternalInstance } from 'vue'
import * as Y from 'yjs'
import { collaboration, fillMap } from '../../collaboration'
import { findBlockById } from '../../core/blocks'
import { blocksToHTML, htmlToBlocks } from '../../core/convert'
import { createEditorView, getBlocks } from '../../core/editor'
import { resolveEditorExtensions } from '../../core/extension'
import type { EditorDocument, PartialBlock } from '../../core/model'
import DouEditor from '../../editor.vue'
import type { EditorExpose } from '../../editor'
import { editorKit } from '../../extensions/editor-kit'
import { blocksToMarkdown, markdownToBlocks } from '../../markdown'
import { boardOf, flowBlock, whiteboardBlock } from '../index'

const BOARD: FlowDocument = {
  version: 1,
  nodes: [
    { id: 'n1', type: 'shape', x: 0, y: 0, width: 120, height: 80, data: { text: '甲' } },
    { id: 'n2', type: 'sticky', x: 200, y: 0, width: 120, height: 120, data: { text: '乙' } },
  ],
  edges: [{ id: 'e1', source: { node: 'n1' }, target: { node: 'n2' } }],
}

const START: PartialBlock[] = [
  { id: 'p', content: '前面' },
  { id: 'w', type: 'whiteboard', props: { board: BOARD } },
]

const boardIn = (view: EditorView, id = 'w') =>
  boardOf(findBlockById(view.state.doc, id)!.content.attrs.board)

/** Changes the board the way the fullscreen editor does. */
function setBoard(view: EditorView, change: (board: FlowDocument) => FlowDocument, id = 'w') {
  const block = findBlockById(view.state.doc, id)!
  view.dispatch(
    view.state.tr.setNodeAttribute(block.contentPos, 'board', change(boardIn(view, id))),
  )
}

const views: EditorView[] = []
const wrappers: { unmount(): void }[] = []
afterEach(() => {
  for (const view of views.splice(0)) view.destroy()
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

function client(doc: Y.Doc) {
  const kit = resolveEditorExtensions([
    editorKit(),
    whiteboardBlock(),
    collaboration({ map: doc.getMap('document') }),
  ])
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

const node = (board: FlowDocument, id: string) => board.nodes.find((n) => n.id === id)

function pair() {
  const source = new Y.Doc()
  fillMap(
    source.getMap('document'),
    { version: 1, blocks: START },
    { extensions: [editorKit(), whiteboardBlock()] },
  )
  const docs = [new Y.Doc(), new Y.Doc()] as const
  for (const doc of docs) Y.applyUpdate(doc, Y.encodeStateAsUpdate(source))
  let online = true
  const pending: [Y.Doc, Uint8Array][] = []
  const relay = (from: Y.Doc, to: Y.Doc) =>
    from.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'relay') return
      if (online) Y.applyUpdate(to, update, 'relay')
      else pending.push([to, update])
    })
  relay(docs[0], docs[1])
  relay(docs[1], docs[0])
  return {
    docs,
    a: client(docs[0]),
    b: client(docs[1]),
    offline: () => (online = false),
    online: () => {
      online = true
      for (const [to, update] of pending.splice(0)) Y.applyUpdate(to, update, 'relay')
    },
  }
}

describe('collaboration', () => {
  it('stores the board node by node', () => {
    const { docs } = pair()
    const block = docs[0].getMap('document').get('w') as Y.Map<unknown>
    const board = (block.get('props') as Y.Map<unknown>).get('board') as Y.Map<unknown>
    expect(board).toBeInstanceOf(Y.Map)
    expect(board.get('nodes')).toBeInstanceOf(Y.Map)
    expect(((board.get('nodes') as Y.Map<unknown>).get('n1') as Y.Map<unknown>).get('x')).toBe(0)
  })

  it('merges changes to different nodes, and to different fields of one node', () => {
    const { a, b, offline, online } = pair()
    offline()
    setBoard(a, (board) => ({
      ...board,
      nodes: board.nodes.map((n) => (n.id === 'n1' ? { ...n, x: 40 } : n)),
    }))
    setBoard(b, (board) => ({
      ...board,
      nodes: board.nodes.map((n) =>
        n.id === 'n2' ? { ...n, data: { text: '乙改' } } : n.id === 'n1' ? { ...n, y: 30 } : n,
      ),
    }))
    online()
    for (const view of [a, b]) {
      const board = boardIn(view)
      expect(node(board, 'n1')).toMatchObject({ x: 40, y: 30 })
      expect(node(board, 'n2')?.data).toEqual({ text: '乙改' })
      expect(board.edges).toHaveLength(1)
    }
    expect(getBlocks(a)).toEqual(getBlocks(b))
  })

  it('keeps a node removed that someone else changed meanwhile', () => {
    const { a, b, offline, online } = pair()
    offline()
    setBoard(a, (board) => ({ ...board, nodes: board.nodes.filter((n) => n.id !== 'n2') }))
    setBoard(b, (board) => ({
      ...board,
      nodes: board.nodes.map((n) => (n.id === 'n2' ? { ...n, x: 999 } : n)),
    }))
    online()
    for (const view of [a, b]) expect(node(boardIn(view), 'n2')).toBeUndefined()
  })

  it('adds nodes from both sides', () => {
    const { a, b, offline, online } = pair()
    offline()
    setBoard(a, (board) => ({
      ...board,
      nodes: [...board.nodes, { id: 'na', type: 'text', x: 0, y: 200, data: { text: 'A' } }],
    }))
    setBoard(b, (board) => ({
      ...board,
      nodes: [...board.nodes, { id: 'nb', type: 'text', x: 0, y: 300, data: { text: 'B' } }],
    }))
    online()
    for (const view of [a, b])
      expect(boardIn(view).nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'na', 'nb'])
  })
})

describe('output', () => {
  const extensions = [editorKit(), whiteboardBlock()]

  it('writes HTML that reads back as the block', () => {
    const html = blocksToHTML(START, extensions)
    expect(html).toContain('<figure data-content-type="whiteboard"')
    expect(html).toContain('<figcaption>白板</figcaption>')
    const [, block] = htmlToBlocks(html, extensions)
    expect(block!.type).toBe('whiteboard')
    expect(boardOf(block!.props.board)).toEqual(BOARD)
  })

  it('uses the app’s own HTML when given', () => {
    const html = blocksToHTML(START, [
      editorKit(),
      whiteboardBlock({ html: (board) => `<img alt="${board.nodes.length} 个图形">` }),
    ])
    expect(html).toContain('<img alt="2 个图形">')
  })

  it('writes Markdown as a fenced block that reads back', () => {
    const markdown = blocksToMarkdown(START, extensions)
    expect(markdown).toContain('```dou-whiteboard\n{')
    const [, block] = markdownToBlocks(markdown, extensions)
    expect(block!.type).toBe('whiteboard')
    expect(boardOf(block!.props.board)).toEqual(BOARD)
  })

  it('reads a board that is not a flow as an empty one', () => {
    expect(boardOf('nope')).toEqual({ version: 1, nodes: [], edges: [] })
    expect(boardOf({ nodes: [1, { id: 'x', x: 0, y: 0 }] }).nodes).toEqual([
      { id: 'x', x: 0, y: 0 },
    ])
  })
})

/** The fullscreen editor, whose node view renders apart from the wrapper's tree. */
function fullscreen() {
  const element = document.querySelector('.dou-dialog .dou-flow-editor')
  const instance = element
    ? (element as unknown as Record<string, ComponentInternalInstance | undefined>)[
        '__vueParentComponent'
      ]
    : undefined
  if (!instance) return undefined
  return {
    vm: instance.exposed as FlowEditorExpose,
    props: (name: string) => (instance.props as Record<string, unknown>)[name],
  }
}

async function open(blocks = START, readonly = false) {
  const value = ref<EditorDocument<PartialBlock>>({ version: 1, blocks })
  const editor = ref<EditorExpose>()
  const extensions = [
    editorKit(),
    whiteboardBlock(),
    flowBlock({ type: 'approval', label: '审批流程' }),
  ]
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouEditor, {
          ref: editor,
          modelValue: value.value,
          'onUpdate:modelValue': (next: EditorDocument) => (value.value = next),
          extensions,
          readonly,
        }),
    ),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  await nextTick()
  const view = editor.value!.view as EditorView
  const block = () =>
    (wrapper.element as HTMLElement).querySelector<HTMLElement>('.dou-editor-board')!
  const openBoard = async () => {
    block().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await nextTick()
    await nextTick()
  }
  return { wrapper, view, value, block, flow: fullscreen, openBoard }
}

describe('in the editor', () => {
  it('offers the whiteboard and the app’s flow in the slash menu', () => {
    const types = resolveEditorExtensions([
      editorKit(),
      whiteboardBlock(),
      flowBlock({ type: 'approval', label: '审批流程' }),
    ]).blockOptions.map((option) => option.type)
    expect(types).toContain('whiteboard')
    expect(types).toContain('approval')
  })

  it('opens the fullscreen editor on double-click, and its changes go into the document', async () => {
    const { flow, openBoard, value } = await open()
    expect(flow()).toBeUndefined()
    await openBoard()
    const editor = flow()!
    expect(editor).toBeTruthy()
    editor.vm.transact((tr) => tr.updateNode('n1', { x: 64 }))
    await nextTick()
    const saved = value.value.blocks[1]!.props!.board as FlowDocument
    expect(saved.nodes.find((n) => n.id === 'n1')?.x).toBe(64)
  })

  it('undoes the board’s changes one by one, a drag as one, and nothing outside it', async () => {
    const { view, flow, openBoard } = await open()
    // a change in the document before the board is opened
    view.dispatch(view.state.tr.insertText('!', findBlockById(view.state.doc, 'p')!.contentPos + 1))
    await openBoard()
    const editor = flow()!.vm
    editor.transact((tr) => tr.updateNode('n1', { x: 10 }))
    editor.transact((tr) => tr.updateNode('n1', { x: 20 }), { group: 'drag' })
    editor.transact((tr) => tr.updateNode('n1', { x: 30 }), { group: 'drag' })
    await nextTick()
    const x = () => boardIn(view).nodes.find((n) => n.id === 'n1')?.x
    expect(x()).toBe(30)
    expect(editor.undo()).toBe(true)
    expect(x()).toBe(10)
    expect(editor.undo()).toBe(true)
    expect(x()).toBe(0)
    // the text typed before stays
    expect(editor.undo()).toBe(false)
    expect(findBlockById(view.state.doc, 'p')!.content.textContent).toBe('!前面')
    expect(editor.redo()).toBe(true)
    expect(editor.redo()).toBe(true)
    expect(x()).toBe(30)
  })

  it('opens with Enter on the selected block', async () => {
    const { view, flow } = await open()
    const { NodeSelection } = await import('prosemirror-state')
    const pos = findBlockById(view.state.doc, 'w')!.contentPos
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
    view.someProp('handleKeyDown', (f) =>
      f(view, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    )
    await nextTick()
    await nextTick()
    expect(flow()).toBeTruthy()
  })

  it('opens read-only when the editor is', async () => {
    const { flow, openBoard } = await open(START, true)
    await openBoard()
    expect(flow()!.props('readonly')).toBe(true)
  })

  it('shows an empty block with a button to start', async () => {
    const { wrapper, flow } = await open([{ id: 'w', type: 'whiteboard' }])
    const button = wrapper.find('.dou-editor-board__empty button')
    expect(button.exists()).toBe(true)
    await button.trigger('click')
    await nextTick()
    expect(flow()).toBeTruthy()
  })
})
