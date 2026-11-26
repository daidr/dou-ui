import {
  defaultNode,
  defineFlowExtension,
  defineNodeType,
  flowKit,
  type FlowDocument,
  type FlowEditorExpose,
  type FlowNode,
} from '@dou-ui/flow'
import { mount } from '@vue/test-utils'
import { DouDialog, type CommentAction, type CommentThread } from 'dou-ui'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, type ComponentInternalInstance } from 'vue'
import * as Y from 'yjs'
import { collaboration, fillMap } from '../../collaboration'
import { findBlockById } from '../../core/blocks'
import { unanchorComment } from '../../core/comments'
import { blocksToHTML, htmlToBlocks } from '../../core/convert'
import { createEditorView, getBlocks } from '../../core/editor'
import { resolveEditorExtensions, type EditorExtension } from '../../core/extension'
import type { EditorDocument, PartialBlock } from '../../core/model'
import DouEditor from '../../editor.vue'
import type { EditorExpose } from '../../editor'
import { checkDocument } from '../../document'
import { editorKit } from '../../extensions/editor-kit'
import { blocksToMarkdown, markdownToBlocks } from '../../markdown'
import { boardComments } from '../board'
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

const ids = (view: EditorView) => boardIn(view).nodes.map((n) => n.id)

const pointer = (type: string, x: number, y = 20) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 7,
    pointerType: 'mouse',
  })

const rectOf = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  }) as DOMRect

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

  it('merges changes to different keys of a node’s data, e.g. its text and its color', () => {
    const { a, b, offline, online } = pair()
    offline()
    setBoard(a, (board) => ({
      ...board,
      nodes: board.nodes.map((n) => (n.id === 'n1' ? { ...n, data: { text: '甲改' } } : n)),
    }))
    setBoard(b, (board) => ({
      ...board,
      nodes: board.nodes.map((n) =>
        n.id === 'n1' ? { ...n, data: { ...n.data, tone: 'success' } } : n,
      ),
    }))
    online()
    for (const view of [a, b])
      expect(node(boardIn(view), 'n1')?.data).toEqual({ text: '甲改', tone: 'success' })
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

  it('keeps the nodes in their order, whatever their ids, as they are added and moved', () => {
    const { a, b } = pair()
    setBoard(a, (board) => ({
      ...board,
      nodes: [...board.nodes, { id: 'a0', type: 'text', x: 0, y: 0, data: { text: '后加' } }],
    }))
    expect(ids(a)).toEqual(['n1', 'n2', 'a0'])
    expect(ids(b)).toEqual(['n1', 'n2', 'a0'])
    // brought to the front: drawn last
    setBoard(b, (board) => ({
      ...board,
      nodes: [board.nodes[1]!, board.nodes[2]!, board.nodes[0]!],
    }))
    expect(ids(a)).toEqual(['n2', 'a0', 'n1'])
    expect(ids(b)).toEqual(['n2', 'a0', 'n1'])
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
    const [, block] = htmlToBlocks(html, [editorKit(), whiteboardBlock()])
    expect(block!.type).toBe('whiteboard')
    expect(boardOf(block!.props.board)).toEqual(BOARD)
  })

  it('writes Markdown as a fenced block that reads back', () => {
    const markdown = blocksToMarkdown(START, extensions)
    expect(markdown).toContain('```dou-whiteboard\n{')
    const [, block] = markdownToBlocks(markdown, extensions)
    expect(block!.type).toBe('whiteboard')
    expect(boardOf(block!.props.board)).toEqual(BOARD)
  })

  it('keeps the height in Markdown and HTML', () => {
    const blocks: PartialBlock[] = [
      { id: 'w', type: 'whiteboard', props: { board: BOARD, height: 520 } },
    ]
    expect(
      markdownToBlocks(blocksToMarkdown(blocks, extensions), extensions)[0]!.props.height,
    ).toBe(520)
    expect(htmlToBlocks(blocksToHTML(blocks, extensions), extensions)[0]!.props.height).toBe(520)
    const typed = htmlToBlocks(
      '<div data-content-type="whiteboard" data-prop-height="320px"></div>',
      extensions,
    )
    expect(typed[0]!.props.height).toBe(320)
  })

  it('reports a board or height the block can’t use in checkDocument', () => {
    const problems = checkDocument(
      {
        version: 1,
        blocks: [
          { id: 'w1', type: 'whiteboard', props: { board: 'nope', height: '大' } },
          {
            id: 'w2',
            type: 'whiteboard',
            props: { board: { version: 1, nodes: [1], edges: [] }, height: 99 },
          },
          { id: 'w3', type: 'whiteboard', props: { board: BOARD, height: 400 } },
        ],
      },
      { extensions },
    )
    expect(problems.map((p) => [p.code, p.blockId, p.path])).toEqual([
      ['invalid-props', 'w1', 'blocks[0].props.board'],
      ['invalid-props', 'w1', 'blocks[0].props.height'],
      ['invalid-props', 'w2', 'blocks[1].props.board.nodes'],
      ['invalid-props', 'w2', 'blocks[1].props.height'],
    ])
  })

  it('reads a board that is not a flow as an empty one', () => {
    expect(boardOf('nope')).toEqual({ version: 1, nodes: [], edges: [] })
    expect(boardOf({ nodes: [1, { id: 'x', x: 0, y: 0 }] }).nodes).toEqual([
      { id: 'x', x: 0, y: 0 },
    ])
  })

  it('leaves out malformed and dangling edges while keeping valid board content', () => {
    const invalid = [
      { id: 'missing-target', source: { node: 'n1' } },
      { id: 'missing-source', target: { node: 'n2' } },
      { id: 'null-target', source: { node: 'n1' }, target: null },
      { id: 'bad-endpoint', source: 'n1', target: { node: 'n2' } },
      { id: 'missing-node', source: {}, target: { node: 'n2' } },
      { id: 'dangling', source: { node: 'gone' }, target: { node: 'n2' } },
      { id: 'bad-port', source: { node: 'n1', port: 42 }, target: { node: 'n2' } },
      { source: { node: 'n1' }, target: { node: 'n2' } },
    ]
    const board = { ...BOARD, edges: [...BOARD.edges, ...invalid] }
    expect(boardOf(board)).toEqual(BOARD)
    const problems = checkDocument(
      { version: 1, blocks: [{ id: 'w', type: 'whiteboard', props: { board } }] },
      { extensions },
    )
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'invalid-props',
        path: 'blocks[0].props.board.edges',
      }),
    ])
    // Reading never changes the source data saved in the document.
    expect(board.edges).toHaveLength(9)
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

async function open(blocks = START, readonly = false, more: EditorExtension[] = []) {
  const value = ref<EditorDocument<PartialBlock>>({ version: 1, blocks })
  const editor = ref<EditorExpose>()
  const extensions = [
    editorKit(),
    whiteboardBlock(),
    flowBlock({ type: 'approval', label: '审批流程' }),
    ...more,
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
  it('shows valid nodes and opens a board imported from Markdown with incomplete edges', async () => {
    const extensions = [editorKit(), whiteboardBlock()]
    const board = {
      ...BOARD,
      edges: [...BOARD.edges, { id: 'broken', source: { node: 'n1' } }],
    }
    const blocks = markdownToBlocks(
      `\u0060\u0060\u0060dou-whiteboard\n${JSON.stringify({ board })}\n\u0060\u0060\u0060`,
      extensions,
    )
    const { block, openBoard, flow, value } = await open(blocks)
    expect(block().querySelector('.dou-editor-board__preview')).toBeTruthy()
    await openBoard()
    expect(flow()!.props('modelValue')).toEqual(BOARD)
    expect(document.querySelector('.dou-dialog [data-node-id="n1"]')).toBeTruthy()
    expect(document.querySelector('.dou-dialog [data-node-id="n2"]')).toBeTruthy()
    expect((value.value.blocks[0]!.props!.board as typeof board).edges).toEqual(BOARD.edges)
  })

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

  it('leaves no undo step for a drag cancelled with Escape', async () => {
    const { view, flow, openBoard } = await open()
    await openBoard()
    const editor = flow()!.vm
    editor.transact((tr) => tr.updateNode('n2', { x: 260 }))
    const root = document.querySelector<HTMLElement>('.dou-dialog .dou-flow-editor')!
    root.querySelector('[data-node-id="n1"]')!.dispatchEvent(pointer('pointerdown', 20))
    for (const x of [40, 60, 80]) root.dispatchEvent(pointer('pointermove', x))
    await nextTick()
    const x = (id: string) => boardIn(view).nodes.find((n) => n.id === id)?.x
    expect(x('n1')).not.toBe(0)
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    root.dispatchEvent(pointer('pointerup', 80))
    await nextTick()
    expect(x('n1')).toBe(0)
    // the first undo takes back the change before the drag
    expect(editor.undo()).toBe(true)
    expect(x('n2')).toBe(200)
  })

  it('keeps a folded group out of the document, and out of the undo steps', async () => {
    const { view, flow, openBoard } = await open()
    await openBoard()
    const editor = flow()!.vm
    editor.transact((tr) => tr.updateNode('n1', { data: { text: '甲', collapsed: true } }))
    await nextTick()
    expect(boardIn(view).nodes.find((n) => n.id === 'n1')?.data).toEqual({ text: '甲' })
    // shown folded here
    const shown = flow()!.props('modelValue') as FlowDocument
    expect(shown.nodes.find((n) => n.id === 'n1')?.data).toEqual({ text: '甲', collapsed: true })
    expect(editor.undo()).toBe(false)
    // a change besides: written, still unfolded in the document
    editor.transact((tr) => tr.updateNode('n1', { x: 50 }))
    await nextTick()
    expect(boardIn(view).nodes.find((n) => n.id === 'n1')).toMatchObject({
      x: 50,
      data: { text: '甲' },
    })
    editor.transact((tr) => tr.updateNode('n1', { data: { text: '甲' } }))
    await nextTick()
    const unfolded = flow()!.props('modelValue') as FlowDocument
    expect(unfolded.nodes.find((n) => n.id === 'n1')?.data).toEqual({ text: '甲' })
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

  it('drags selected edge endpoints in the embedded whiteboard to reconnect, detach, and cancel with Escape', async () => {
    const board: FlowDocument = {
      version: 1,
      nodes: [
        { id: 'n1', type: 'shape', x: 0, y: 0, width: 120, height: 80, data: { text: '甲' } },
        { id: 'n2', type: 'sticky', x: 240, y: 0, width: 120, height: 120, data: { text: '乙' } },
        { id: 'n3', type: 'shape', x: 240, y: 220, width: 120, height: 80, data: { text: '丙' } },
      ],
      edges: [{ id: 'e1', source: { node: 'n1' }, target: { node: 'n2' } }],
    }
    const boxMap: Record<string, { x: number; y: number; w: number; h: number }> = {
      n1: { x: 0, y: 0, w: 120, h: 80 },
      n2: { x: 240, y: 0, w: 120, h: 120 },
      n3: { x: 240, y: 220, w: 120, h: 80 },
    }
    const origWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    const origHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    const origRect = HTMLElement.prototype.getBoundingClientRect
    const origPoint = document.elementFromPoint
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return (this.dataset.nodeId && boxMap[this.dataset.nodeId]?.w) || 120
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return (this.dataset.nodeId && boxMap[this.dataset.nodeId]?.h) || 80
      },
    })
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const nodeEl = this.closest<HTMLElement>('[data-node-id]')
      const box = nodeEl && boxMap[nodeEl.dataset.nodeId!]
      if (this.classList.contains('dou-flow-port') && box) {
        if (this.classList.contains('is-right'))
          return rectOf(box.x + box.w, box.y + box.h / 2, 0, 0)
        if (this.classList.contains('is-left')) return rectOf(box.x, box.y + box.h / 2, 0, 0)
        if (this.classList.contains('is-top')) return rectOf(box.x + box.w / 2, box.y, 0, 0)
        if (this.classList.contains('is-bottom'))
          return rectOf(box.x + box.w / 2, box.y + box.h, 0, 0)
      }
      if (this.dataset.nodeId && box) return rectOf(box.x, box.y, box.w, box.h)
      return origRect.call(this)
    }
    try {
      const { view, flow, openBoard } = await open([
        { id: 'p', content: '前面' },
        { id: 'w', type: 'whiteboard', props: { board } },
      ])
      await openBoard()
      for (let i = 0; i < 4; i++) await nextTick()
      const editor = flow()!.vm
      editor.setViewport({ x: 0, y: 0, zoom: 1 })
      for (let i = 0; i < 4; i++) await nextTick()
      const root = document.querySelector<HTMLElement>('.dou-dialog .dou-flow-editor')!
      document.elementFromPoint = () => root

      // Select the edge by clicking its hit path.
      root
        .querySelector('[data-edge-id="e1"] .dou-flow-editor__edge-hit')!
        .dispatchEvent(pointer('pointerdown', 180, 50))
      await nextTick()
      const handles = root.querySelectorAll('.dou-flow-editor__edge-end')
      expect(handles).toHaveLength(2)

      // Escape during an endpoint drag cancels the drag without closing the fullscreen dialog.
      const targetHandle = root.querySelector<HTMLElement>(
        '.dou-flow-editor__edge-end[data-edge-end="target"]',
      )!
      targetHandle.dispatchEvent(pointer('pointerdown', 240, 60))
      root.dispatchEvent(pointer('pointermove', 500, 120))
      await nextTick()
      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      )
      root.dispatchEvent(pointer('pointerup', 500, 120))
      await nextTick()
      expect(flow()).toBeTruthy()
      expect(boardIn(view).edges[0]!.target.node).toBe('n2')
      expect(editor.undo()).toBe(false)

      // Dragging omitted-port target away and back onto n2's default anchor leaves no undo step.
      const sameHandle = root.querySelector<HTMLElement>(
        '.dou-flow-editor__edge-end[data-edge-end="target"]',
      )!
      sameHandle.dispatchEvent(pointer('pointerdown', 240, 60))
      root.dispatchEvent(pointer('pointermove', 500, 120))
      root.dispatchEvent(pointer('pointermove', 240, 60))
      root.dispatchEvent(pointer('pointerup', 240, 60))
      await nextTick()
      expect(boardIn(view).edges).toEqual([
        { id: 'e1', source: { node: 'n1' }, target: { node: 'n2' } },
      ])
      expect(editor.undo()).toBe(false)

      // Drag target endpoint to n3's left-in port at (240, 260) as one undo step.
      const activeHandle = root.querySelector<HTMLElement>(
        '.dou-flow-editor__edge-end[data-edge-end="target"]',
      )!
      activeHandle.dispatchEvent(pointer('pointerdown', 240, 60))
      root.dispatchEvent(pointer('pointermove', 240, 260))
      root.dispatchEvent(pointer('pointerup', 240, 260))
      await nextTick()
      expect(boardIn(view).edges).toEqual([
        { id: 'e1', source: { node: 'n1' }, target: { node: 'n3', port: 'left-in' } },
      ])
      expect(editor.undo()).toBe(true)
      expect(boardIn(view).edges[0]!.target).toEqual({ node: 'n2' })
      expect(editor.redo()).toBe(true)
      expect(boardIn(view).edges[0]!.target).toEqual({ node: 'n3', port: 'left-in' })

      // Drag target endpoint onto empty canvas to detach, then undo back into the document.
      const nextHandle = root.querySelector<HTMLElement>(
        '.dou-flow-editor__edge-end[data-edge-end="target"]',
      )!
      nextHandle.dispatchEvent(pointer('pointerdown', 240, 260))
      root.dispatchEvent(pointer('pointermove', 520, 160))
      root.dispatchEvent(pointer('pointerup', 520, 160))
      await nextTick()
      expect(boardIn(view).edges).toHaveLength(0)
      expect(editor.undo()).toBe(true)
      expect(boardIn(view).edges).toHaveLength(1)
      expect(boardIn(view).edges[0]!.id).toBe('e1')
    } finally {
      if (origWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origWidth)
      if (origHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origHeight)
      HTMLElement.prototype.getBoundingClientRect = origRect
      document.elementFromPoint = origPoint
    }
  })
})

/** The fullscreen editor of a board in an editor that edits together with `peer`. */
async function openTogether() {
  const source = new Y.Doc()
  fillMap(
    source.getMap('document'),
    { version: 1, blocks: START },
    { extensions: [editorKit(), whiteboardBlock()] },
  )
  const docs = [new Y.Doc(), new Y.Doc()] as const
  for (const doc of docs) Y.applyUpdate(doc, Y.encodeStateAsUpdate(source))
  docs[0].on(
    'update',
    (u: Uint8Array, o: unknown) => o !== 'relay' && Y.applyUpdate(docs[1], u, 'relay'),
  )
  docs[1].on(
    'update',
    (u: Uint8Array, o: unknown) => o !== 'relay' && Y.applyUpdate(docs[0], u, 'relay'),
  )
  const peer = client(docs[1])
  const editor = ref<EditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouEditor, {
          ref: editor,
          extensions: [
            editorKit(),
            whiteboardBlock(),
            collaboration({ map: docs[0].getMap('document') }),
          ],
        }),
    ),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  await nextTick()
  const view = editor.value!.view as EditorView
  ;(wrapper.element as HTMLElement)
    .querySelector('.dou-editor-board')!
    .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await nextTick()
  await nextTick()
  return { view, peer, vm: fullscreen()!.vm }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const xOf = (view: EditorView, id: string) => boardIn(view).nodes.find((n) => n.id === id)?.x
const textOf = (view: EditorView, id: string) =>
  boardIn(view).nodes.find((n) => n.id === id)?.data?.text

describe('undo while editing together', () => {
  it('undoes two drags of the same node one by one', async () => {
    const { view, vm } = await openTogether()
    vm.transact((tr) => tr.updateNode('n1', { x: 10 }))
    vm.transact((tr) => tr.updateNode('n1', { x: 20 }), { group: 'drag:1' })
    await wait(600)
    vm.transact((tr) => tr.updateNode('n1', { x: 30 }), { group: 'drag:1' })
    vm.transact((tr) => tr.updateNode('n1', { x: 40 }), { group: 'drag:2' })
    vm.transact((tr) => tr.updateNode('n1', { x: 50 }), { group: 'drag:2' })
    await nextTick()
    const seen: unknown[] = []
    for (let i = 0; i < 4; i++) seen.push(`${vm.undo()}:${xOf(view, 'n1')}`)
    expect(seen).toEqual(['true:30', 'true:10', 'true:0', 'false:0'])
  })

  it('keeps what the other person changed during a drag, when the drag is undone', async () => {
    const { view, peer, vm } = await openTogether()
    vm.transact((tr) => tr.updateNode('n1', { x: 20 }), { group: 'drag:1' })
    setBoard(peer, (board) => ({
      ...board,
      nodes: board.nodes.map((n) => (n.id === 'n2' ? { ...n, data: { text: '对方改的' } } : n)),
    }))
    await nextTick()
    vm.transact((tr) => tr.updateNode('n1', { x: 30 }), { group: 'drag:1' })
    await nextTick()
    expect(textOf(view, 'n2')).toBe('对方改的')
    expect(vm.undo()).toBe(true)
    await nextTick()
    expect(xOf(view, 'n1')).toBe(0)
    for (const side of [view, peer]) expect(textOf(side, 'n2')).toBe('对方改的')
  })
})

const addButton = () => [
  ...document.querySelectorAll<HTMLButtonElement>('.dou-editor-board__add button'),
]
const nodesOf = (view: EditorView, id: string) => boardIn(view, id).nodes

const card = (type: string, label: string, group: string) =>
  defineNodeType({
    ...defaultNode,
    type,
    defaults: () => ({ label }),
    palette: { label, group, description: `${label}的说明` },
  })

const reviewBlock = () =>
  flowBlock({
    type: 'review',
    label: '审核',
    extensions: [
      flowKit(),
      defineFlowExtension({
        name: 'review',
        nodeTypes: [
          card('start', '开始', '起止'),
          card('check', '审核', '处理'),
          card('end', '结束', '起止'),
        ],
      }),
    ],
  })

describe('adding nodes', () => {
  it('offers a node with ports in a flow block, added as one undo step', async () => {
    const { wrapper, view, flow } = await open([{ id: 'f', type: 'approval' }])
    await wrapper.find('.dou-editor-board__empty button').trigger('click')
    await nextTick()
    await nextTick()
    expect(document.querySelector('.dou-editor-board__hint')?.textContent).toContain('添加节点')
    const [button] = addButton()
    expect(button?.textContent).toContain('添加节点')
    button!.click()
    await nextTick()
    const [added] = nodesOf(view, 'f')
    expect(added?.data).toMatchObject({
      label: '节点',
      inputs: [{ id: 'in' }],
      outputs: [{ id: 'out' }],
    })
    expect(document.querySelector('.dou-editor-board__hint')).toBeNull()
    // the next one is joined to it
    addButton()[0]!.click()
    await nextTick()
    expect(nodesOf(view, 'f')).toHaveLength(2)
    expect(boardIn(view, 'f').edges).toHaveLength(1)
    expect(flow()!.vm.undo()).toBe(true)
    expect(nodesOf(view, 'f')).toHaveLength(1)
  })

  it('offers the same node when flowKit() is given', async () => {
    const block = flowBlock({ type: 'plain', label: '流程', extensions: [flowKit()] })
    const { wrapper } = await open([{ id: 'f', type: 'plain' }], false, [block])
    await wrapper.find('.dou-editor-board__empty button').trigger('click')
    await nextTick()
    await nextTick()
    expect(addButton()[0]?.textContent).toContain('添加节点')
  })

  it('lists several types in groups, searchable, each one added on choosing it', async () => {
    const { wrapper, view } = await open([{ id: 'r', type: 'review' }], false, [reviewBlock()])
    await wrapper.find('.dou-editor-board__empty button').trigger('click')
    await nextTick()
    await nextTick()
    addButton()[0]!.click()
    await nextTick()
    await nextTick()
    const list = document.querySelector('.dou-editor-board__types')!
    expect(list.querySelectorAll('.dou-command__group').length).toBeGreaterThan(0)
    expect(list.textContent).toContain('审核的说明')
    list.querySelector<HTMLElement>('.dou-editor-board__type')!.click()
    await nextTick()
    expect(nodesOf(view, 'r')).toHaveLength(1)
  })

  it('gives the focus back to the button when a drag from the list ends off the canvas', async () => {
    const { wrapper } = await open([{ id: 'r', type: 'review' }], false, [reviewBlock()])
    await wrapper.find('.dou-editor-board__empty button').trigger('click')
    await nextTick()
    await nextTick()
    const trigger = addButton()[0]!
    trigger.click()
    await nextTick()
    await nextTick()
    const list = document.querySelector('.dou-editor-board__types')!
    list.querySelector<HTMLInputElement>('input')!.focus()
    list
      .querySelector('.dou-editor-board__type')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 3 }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 3 }))
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(trigger)
  })

  it('leaves the button out of a whiteboard, which has its own tools', async () => {
    const { openBoard } = await open()
    await openBoard()
    expect(addButton()).toHaveLength(0)
  })

  it('leaves it out when read-only', async () => {
    const { openBoard } = await open(START, true)
    await openBoard()
    expect(addButton()).toHaveLength(0)
  })
})

/** The blocks of `START`, with `on` on node n1. */
const commented = (on: Partial<FlowNode>): PartialBlock[] => [
  { id: 'p', content: '前面' },
  {
    id: 'w',
    type: 'whiteboard',
    props: {
      board: { ...BOARD, nodes: BOARD.nodes.map((n) => (n.id === 'n1' ? { ...n, ...on } : n)) },
    },
  },
]

describe('comments on the nodes and edges', () => {
  const dai = { id: 'dai', name: '戴兜' }
  const thread = (id: string): CommentThread => ({
    id,
    comments: [
      { id: `${id}-1`, author: dai, body: '看一下', createdAt: '2026-11-11T08:00:00.000Z' },
    ],
  })
  async function withComments(
    blocks = START,
    threads: CommentThread[] = [],
    readonly = false,
    onAction?: (action: CommentAction) => void,
  ) {
    const value = ref<EditorDocument<PartialBlock>>({ version: 1, blocks })
    const comments = ref(threads)
    const active = ref<string | null>(null)
    const actions: CommentAction[] = []
    const editor = ref<EditorExpose>()
    const extensions = [editorKit(), whiteboardBlock()]
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouEditor, {
            ref: editor,
            modelValue: value.value,
            'onUpdate:modelValue': (next: EditorDocument) => (value.value = next),
            comments: comments.value,
            'onUpdate:comments': (next: CommentThread[]) => (comments.value = next),
            activeComment: active.value,
            'onUpdate:activeComment': (id: string | null) => (active.value = id),
            onCommentAction: (action: CommentAction) => {
              actions.push(action)
              onAction?.(action)
            },
            author: dai,
            readonly,
            extensions,
          }),
      ),
      { attachTo: document.body },
    )
    wrappers.push(wrapper)
    await nextTick()
    const view = editor.value!.view as EditorView
    const openBoard = async () => {
      wrapper.element
        .querySelector('.dou-editor-board')!
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await nextTick()
      await nextTick()
    }
    return { view, editor, comments, active, actions, openBoard }
  }

  /** Sends the first comment of the thread being started, as the card's button would. */
  async function send(id: string) {
    const box = document.querySelector('.dou-dialog .dou-comment-thread')!
    const instance = (box as unknown as Record<string, ComponentInternalInstance>)[
      '__vueParentComponent'
    ]!
    const onAction = instance.vnode.props!.onAction as (action: CommentAction) => void
    onAction({ type: 'create', thread: thread(id) })
    await nextTick()
  }

  it('describes where threads are kept on a board', () => {
    const board: FlowDocument = {
      ...BOARD,
      nodes: [
        { ...BOARD.nodes[0]!, comments: ['t1', 't2'], commentPins: { t2: { x: 0.5, y: 0.25 } } },
        BOARD.nodes[1]!,
      ],
      edges: [{ ...BOARD.edges[0]!, label: '然后', comments: ['t3'] }],
    }
    expect(boardComments.anchors({ board })).toEqual({
      t1: { text: '甲', target: { node: 'n1' } },
      t2: { text: '甲', target: { node: 'n1', at: { x: 0.5, y: 0.25 }, number: 1 } },
      t3: { text: '然后', target: { edge: 'e1' } },
    })
    const stripped = boardOf(boardComments.strip({ board }, (id) => id === 't2').board)
    expect(stripped.nodes[0]).toMatchObject({
      comments: ['t2'],
      commentPins: { t2: { x: 0.5, y: 0.25 } },
    })
    expect(stripped.edges[0]).not.toHaveProperty('comments')
    // nothing to strip: the same props back
    const plain = { board: BOARD }
    expect(boardComments.strip(plain, () => false)).toBe(plain)
    const placed = boardComments.place(plain, 't4', { node: 'n2', at: { x: 0, y: 1 } })!
    expect(boardOf(placed.board).nodes[1]).toMatchObject({
      comments: ['t4'],
      commentPins: { t4: { x: 0, y: 1 } },
    })
    expect(boardComments.place(plain, 't4', { node: 'gone' })).toBeNull()
    expect(boardComments.place(plain, 't4', { edge: 'gone' })).toBeNull()
  })

  it('starts a thread on a node in the fullscreen editor, kept with the document’s', async () => {
    const { view, editor, comments, active, actions, openBoard } = await withComments()
    await openBoard()
    const flow = fullscreen()!
    expect(flow.props('comments')).toEqual([])
    expect(flow.props('author')).toEqual(dai)
    expect(flow.props('commentable')).toBe(true)
    expect(flow.vm.comment({ node: 'n1' })).toBe(true)
    await nextTick()
    await send('t1')
    expect(boardIn(view).nodes[0]!.comments).toEqual(['t1'])
    expect(comments.value.map((t) => t.id)).toEqual(['t1'])
    expect(actions.map((a) => a.type)).toEqual(['create'])
    expect(active.value).toBe('t1')
    expect(editor.value!.getCommentAnchors()).toEqual({
      t1: expect.objectContaining({
        block: 'w',
        text: '甲',
        type: 'whiteboard',
        target: { node: 'n1' },
      }),
    })
    // not an undo step
    expect(flow.vm.undo()).toBe(false)
  })

  it('starts one in a read-only document too', async () => {
    const { view, openBoard } = await withComments(START, [], true)
    await openBoard()
    expect(fullscreen()!.vm.comment({ node: 'n2' })).toBe(true)
    await nextTick()
    await send('t1')
    expect(boardIn(view).nodes[1]!.comments).toEqual(['t1'])
  })

  it('opens the board at a thread chosen outside, and closes the thread with it', async () => {
    const { active } = await withComments(commented({ comments: ['t1'] }), [thread('t1')])
    expect(fullscreen()).toBeUndefined()
    active.value = 't1'
    await nextTick()
    await nextTick()
    expect(fullscreen()).toBeTruthy()
    // closing the editor, as its button would
    let dialog = (
      document.querySelector('.dou-dialog .dou-flow-editor') as unknown as Record<
        string,
        ComponentInternalInstance
      >
    )['__vueParentComponent']!
    while (dialog.type !== DouDialog) dialog = dialog.parent!
    ;(dialog.vnode.props!.onClose as () => void)()
    await nextTick()
    expect(active.value).toBeNull()
  })

  it('keeps a thread through undo and redo of the board’s changes', async () => {
    const { view, openBoard } = await withComments(START, [])
    await openBoard()
    const flow = fullscreen()!.vm
    flow.transact((tr) => tr.updateNode('n1', { x: 40 }))
    flow.comment({ node: 'n1' })
    await nextTick()
    await send('t1')
    flow.transact((tr) => tr.updateNode('n2', { x: 300 }))
    const nodeOf = (id: string) => boardIn(view).nodes.find((n) => n.id === id)!
    expect(flow.undo()).toBe(true)
    expect(nodeOf('n2').x).toBe(200)
    expect(nodeOf('n1').comments).toEqual(['t1'])
    expect(flow.undo()).toBe(true)
    expect(nodeOf('n1')).toMatchObject({ x: 0, comments: ['t1'] })
    expect(flow.redo()).toBe(true)
    expect(flow.redo()).toBe(true)
    expect(nodeOf('n1')).toMatchObject({ x: 40, comments: ['t1'] })
  })

  it('leaves a removed thread off its node through undo and redo', async () => {
    const { view, comments, openBoard } = await withComments(commented({ comments: ['t1'] }), [
      thread('t1'),
    ])
    await openBoard()
    const flow = fullscreen()!.vm
    flow.transact((tr) => tr.updateNode('n2', { x: 300 }))
    // the thread deleted, as the card's delete button does
    comments.value = []
    await nextTick()
    unanchorComment(view, 't1')
    const n1 = () => boardIn(view).nodes.find((n) => n.id === 'n1')!
    expect(n1().comments).toBeUndefined()
    expect(flow.undo()).toBe(true)
    expect(boardIn(view).nodes.find((n) => n.id === 'n2')!.x).toBe(200)
    expect(n1().comments).toBeUndefined()
    expect(flow.redo()).toBe(true)
    expect(n1().comments).toBeUndefined()
  })

  it('brings a thread back with its node when the removal is undone', async () => {
    const { view, editor, openBoard } = await withComments(commented({ comments: ['t1'] }), [
      thread('t1'),
    ])
    await openBoard()
    const flow = fullscreen()!.vm
    flow.transact((tr) => tr.removeNode('n1'))
    expect(editor.value!.getCommentAnchors().t1).toBeNull()
    expect(flow.undo()).toBe(true)
    expect(boardIn(view).nodes.find((n) => n.id === 'n1')!.comments).toEqual(['t1'])
    expect(editor.value!.getCommentAnchors().t1).toMatchObject({ target: { node: 'n1' } })
  })

  it('keeps a thread on a new node through undo and redo of adding it', async () => {
    const { view, editor, openBoard } = await withComments(START, [])
    await openBoard()
    const flow = fullscreen()!.vm
    flow.transact((tr) => tr.addNode({ ...BOARD.nodes[0]!, id: 'n3', x: 400 }))
    flow.comment({ node: 'n3' })
    await nextTick()
    await send('t1')
    expect(flow.undo()).toBe(true)
    expect(boardIn(view).nodes.some((n) => n.id === 'n3')).toBe(false)
    expect(flow.redo()).toBe(true)
    expect(boardIn(view).nodes.find((n) => n.id === 'n3')!.comments).toEqual(['t1'])
    expect(editor.value!.getCommentAnchors().t1).toMatchObject({ target: { node: 'n3' } })
  })

  it('takes a removed thread off its node', async () => {
    const { view } = await withComments(commented({ comments: ['t1', 't2'] }), [
      thread('t1'),
      thread('t2'),
    ])
    unanchorComment(view, 't1')
    expect(boardIn(view).nodes[0]!.comments).toEqual(['t2'])
  })

  it('leaves the threads out of a pasted copy of the block', async () => {
    const { view } = await withComments(commented({ comments: ['t1'] }), [thread('t1')])
    const block = findBlockById(view.state.doc, 'w')!
    const copied = view.state.doc.slice(block.pos, block.pos + block.node.nodeSize)
    let pasted = copied
    view.someProp('transformPasted', (transform) => {
      pasted = transform(pasted, view, false)
    })
    let kept: unknown = 'none'
    pasted.content.descendants((child) => {
      if (child.type.name === 'whiteboard') kept = boardOf(child.attrs.board).nodes[0]!.comments
      return true
    })
    expect(kept).toBeUndefined()
  })

  it('exposes the board comment anchor synchronously inside @comment-action on create', async () => {
    let seenAnchor: unknown
    const { editor, openBoard } = await withComments(START, [], false, (action) => {
      if (action.type === 'create') seenAnchor = editor.value!.getCommentAnchors()[action.thread.id]
    })
    await openBoard()
    fullscreen()!.vm.comment({ node: 'n1', at: { x: 0.5, y: 0.25 } })
    await nextTick()
    await send('wb-sync')
    expect(seenAnchor).toMatchObject({
      block: 'w',
      type: 'whiteboard',
      target: { node: 'n1', at: { x: 0.5, y: 0.25 }, number: 1 },
    })
  })

  it('leaves them out with `commentable: false`', () => {
    const { schema } = resolveEditorExtensions([
      editorKit(),
      whiteboardBlock({ commentable: false }),
    ])
    expect(schema.nodes.whiteboard!.spec.comments).toBeUndefined()
  })
})

const visibleColorPopover = () =>
  [...document.body.querySelectorAll<HTMLElement>('.dou-flow-color-popover')].find(
    (el) => el.style.display !== 'none',
  ) ?? null

async function flushBoard() {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('whiteboard colors and borderless editing in document block', () => {
  it('round-trips colors and borderless fields through HTML, Markdown and fullscreen editing with undo/redo', async () => {
    const styledBoard: FlowDocument = {
      version: 1,
      nodes: [
        {
          id: 's1',
          type: 'shape',
          x: 0,
          y: 0,
          width: 140,
          height: 80,
          data: {
            shape: 'rect',
            text: '模块',
            fill: 'blue',
            stroke: 'none',
            textColor: 'purple',
          },
        },
        {
          id: 't1',
          type: 'text',
          x: 220,
          y: 0,
          width: 120,
          data: { text: '批注', color: 'red' },
        },
      ],
      edges: [
        {
          id: 'c1',
          type: 'connector',
          source: { node: 's1', port: 'right' },
          target: { node: 't1', port: 'left-in' },
          data: { color: 'green' },
        },
      ],
    }

    const extensions = [editorKit(), whiteboardBlock()]
    const blocks: PartialBlock[] = [
      { id: 'w', type: 'whiteboard', props: { board: styledBoard, height: 320 } },
    ]
    // Markdown round-trip (`dou-whiteboard` code fence)
    const md = blocksToMarkdown(blocks, extensions)
    const fromMd = markdownToBlocks(md, extensions)
    expect(boardOf(fromMd[0]!.props!.board)).toEqual(styledBoard)

    // HTML round-trip
    const html = blocksToHTML(blocks, extensions)
    const fromHtml = htmlToBlocks(html, extensions)
    expect(boardOf(fromHtml[0]!.props!.board)).toEqual(styledBoard)

    // Fullscreen editing syncs color/borderless updates to ProseMirror with undo/redo
    const { view, openBoard, flow } = await open(blocks)
    await openBoard()
    const editor = flow()!.vm
    editor.transact((tr) => {
      tr.updateNode('s1', {
        data: {
          shape: 'rect',
          text: '模块',
          fill: 'orange',
          stroke: 'red',
          textColor: '#3b6ea8',
        },
      })
      tr.updateEdge('c1', { data: { color: '#b4453f' } })
    })
    await nextTick()
    expect(boardIn(view, 'w').nodes[0]!.data).toMatchObject({
      fill: 'orange',
      stroke: 'red',
      textColor: '#3b6ea8',
    })
    expect(boardIn(view, 'w').edges[0]!.data).toEqual({ color: '#b4453f' })

    expect(editor.undo()).toBe(true)
    await nextTick()
    expect(boardIn(view, 'w').nodes[0]!.data).toMatchObject({
      fill: 'blue',
      stroke: 'none',
      textColor: 'purple',
    })
    expect(boardIn(view, 'w').edges[0]!.data).toEqual({ color: 'green' })

    expect(editor.redo()).toBe(true)
    await nextTick()
    expect(boardIn(view, 'w').nodes[0]!.data).toMatchObject({ fill: 'orange', stroke: 'red' })
  })

  it('edits shape and connector colors via the floating toolbar inside the fullscreen dialog', async () => {
    const restore: [string, PropertyDescriptor | undefined][] = []
    const mocks: Record<string, (el: HTMLElement) => number> = {
      offsetWidth: (el) => parseFloat(el.style.width) || 120,
      offsetHeight: (el) => parseFloat(el.style.height) || 80,
      clientWidth: () => 1200,
      clientHeight: () => 800,
    }
    for (const [key, fn] of Object.entries(mocks)) {
      restore.push([key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)])
      Object.defineProperty(HTMLElement.prototype, key, {
        configurable: true,
        get(this: HTMLElement) {
          return fn(this)
        },
      })
    }
    try {
      const { view, openBoard } = await open([
        {
          id: 'w',
          type: 'whiteboard',
          props: {
            board: {
              version: 1,
              nodes: BOARD.nodes,
              edges: [
                {
                  id: 'e1',
                  type: 'connector',
                  source: { node: 'n1', port: 'right' },
                  target: { node: 'n2', port: 'left-in' },
                },
              ],
            },
          },
        },
      ])
      await openBoard()
      await nextTick()
      await nextTick()

      const dialogEditor = document.querySelector<HTMLElement>('.dou-dialog .dou-flow-editor')!

      // Select shape node `n1` inside the fullscreen whiteboard
      const shapeNode = dialogEditor.querySelector<HTMLElement>('[data-node-id="n1"]')!
      shapeNode.dispatchEvent(pointer('pointerdown', 20))
      window.dispatchEvent(pointer('pointerup', 20))
      await flushBoard()

      const toolbarButtons = () => [
        ...dialogEditor.querySelectorAll<HTMLButtonElement>('.dou-flow-toolbar button'),
      ]
      expect(
        toolbarButtons()
          .slice(0, 3)
          .map((b) => b.getAttribute('aria-label')),
      ).toEqual(['背景颜色：默认', '边框颜色：默认', '文字颜色：默认'])

      // Fill: blue
      toolbarButtons()[0]!.click()
      await flushBoard()
      visibleColorPopover()!.querySelector<HTMLButtonElement>('button[aria-label="蓝色"]')!.click()
      await flushBoard()

      // Border: none (borderless)
      toolbarButtons()[1]!.click()
      await flushBoard()
      visibleColorPopover()!
        .querySelector<HTMLButtonElement>('.dou-flow-color-popover__none')!
        .click()
      await flushBoard()

      // Text color: purple
      toolbarButtons()[2]!.click()
      await flushBoard()
      visibleColorPopover()!.querySelector<HTMLButtonElement>('button[aria-label="紫色"]')!.click()
      await flushBoard()

      expect(boardIn(view, 'w').nodes[0]!.data).toEqual({
        text: '甲',
        fill: 'blue',
        stroke: 'none',
        textColor: 'purple',
      })

      // Select connector edge `e1` and set its color to red
      const edgeHit = dialogEditor.querySelector<SVGPathElement>(
        '[data-edge-id="e1"] .dou-flow-editor__edge-hit',
      )!
      edgeHit.dispatchEvent(pointer('pointerdown', 120))
      window.dispatchEvent(pointer('pointerup', 120))
      await flushBoard()

      const edgeColorButton = toolbarButtons().find((b) =>
        b.getAttribute('aria-label')?.startsWith('线条颜色'),
      )!
      edgeColorButton.click()
      await flushBoard()
      visibleColorPopover()!.querySelector<HTMLButtonElement>('button[aria-label="红色"]')!.click()
      await flushBoard()

      expect(boardIn(view, 'w').edges[0]!.data).toEqual({ color: 'red' })
      // Fullscreen dialog remains open after interacting with the teleported color popover
      expect(document.querySelector('.dou-dialog .dou-flow-editor')).not.toBeNull()

      // Fullscreen whiteboard canvas renders the updated colors and borderless state
      const renderedShape = dialogEditor.querySelector<HTMLElement>(
        '[data-node-id="n1"] .dou-whiteboard-node',
      )!
      expect(renderedShape.classList.contains('is-borderless')).toBe(true)
      expect(renderedShape.getAttribute('style')).toContain(
        '--dou-whiteboard-shape-fill: var(--dou-whiteboard-fill-blue)',
      )
      expect(renderedShape.getAttribute('style')).toContain(
        '--dou-whiteboard-text-color: var(--dou-whiteboard-color-purple)',
      )
      const renderedEdge = dialogEditor.querySelector<SVGPathElement>(
        '[data-edge-id="e1"] .dou-flow-editor__edge',
      )!
      expect(renderedEdge.getAttribute('style')).toContain(
        '--dou-flow-connector-color: var(--dou-whiteboard-color-red)',
      )
    } finally {
      for (const [key, desc] of restore) {
        if (desc) Object.defineProperty(HTMLElement.prototype, key, desc)
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key]
      }
    }
  })
})
