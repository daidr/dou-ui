import { mount } from '@vue/test-utils'
import { DouCommentThread, type CommentAction, type CommentThread } from 'dou-ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouFlowEditor, flowKit, type FlowEditorExpose } from '../index'
import { whiteboardKit, type WhiteboardTool } from '../whiteboard'
import type { FlowDocument, FlowSelection } from '../index'

// happy-dom lays nothing out: give every element a size so nodes get measured.
const descriptors = new Map<string, PropertyDescriptor | undefined>()
const sizes: Record<string, number> = {
  offsetWidth: 200,
  offsetHeight: 60,
  clientWidth: 800,
  clientHeight: 600,
}
beforeAll(() => {
  for (const [key, value] of Object.entries(sizes)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key))
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value })
  }
})
afterAll(() => {
  for (const [key, descriptor] of descriptors)
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
})
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const at = '2026-11-05T08:00:00.000Z'

const doc = (): FlowDocument => ({
  version: 1,
  nodes: [
    {
      id: 'a',
      x: 0,
      y: 0,
      data: { label: '主管审批', outputs: [{ id: 'out' }] },
      comments: ['t1'],
    },
    { id: 'b', x: 300, y: 0, data: { label: '财务复核', inputs: [{ id: 'in' }] } },
  ],
  edges: [
    {
      id: 'e',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      comments: ['t2', 'done'],
    },
  ],
})
const thread = (id: string, body: string, resolved = false): CommentThread => ({
  id,
  comments: [{ id: `${id}-1`, author: qing, body, createdAt: at }],
  ...(resolved ? { resolved: { by: me, at } } : {}),
})

function setup(props: Record<string, unknown> = {}, selected: string[] = []) {
  const flow = ref(doc())
  const threads = ref<CommentThread[]>([
    thread('t1', '复核要不要限时？'),
    thread('t2', '5000 元以下直接打款？'),
    thread('done', '已经定了', true),
  ])
  const active = ref<string | null>(null)
  const actions: CommentAction[] = []
  const selection = ref<FlowSelection>({ nodes: selected, edges: [] })
  const editor = ref<FlowEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          ref: editor,
          modelValue: flow.value,
          'onUpdate:modelValue': (value: FlowDocument) => (flow.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
          comments: threads.value,
          'onUpdate:comments': (value: CommentThread[]) => (threads.value = value),
          activeComment: active.value,
          'onUpdate:activeComment': (value: string | null) => (active.value = value),
          onCommentAction: (action: CommentAction) => actions.push(action),
          author: me,
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  return { wrapper, editor, flow, threads, active, actions, selection }
}

const card = () => document.querySelector('.dou-flow-editor__comment-card')

const ticks = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

describe('DouFlowEditor comments', () => {
  it('marks nodes and edges with open threads, and opens them from the marker', async () => {
    const { wrapper, active } = setup()
    await ticks()
    const markers = wrapper.findAll('.dou-flow-editor__comment')
    // the resolved one on the edge isn't counted
    expect(markers.map((m) => m.attributes('aria-label'))).toEqual(['1 条评论', '1 条评论'])
    await markers[1]!.trigger('click')
    await ticks()
    expect(active.value).toBe('t2')
    const shown = card()!
    expect(shown.textContent).toContain('5000 元以下直接打款？')
    expect(markers[1]!.attributes('aria-expanded')).toBe('true')
  })

  it('starts a thread on the selected node, kept on the node but not in undo', async () => {
    const { wrapper, editor, flow, threads, actions, active } = setup({}, ['b'])
    await ticks()
    expect(editor.value!.comment()).toBe(true)
    await ticks()
    const box = wrapper.findComponent(DouCommentThread)
    expect(box.props('thread')).toBe(null)
    const created: CommentThread = {
      id: 'new',
      comments: [{ id: 'n1', author: me, body: '打款后通知戴兜', createdAt: at }],
    }
    box.vm.$emit('action', { type: 'create', thread: created })
    await ticks()
    expect(flow.value.nodes.find((n) => n.id === 'b')!.comments).toEqual(['new'])
    expect(threads.value.map((t) => t.id)).toEqual(['t1', 't2', 'done', 'new'])
    expect(actions.map((a) => a.type)).toEqual(['create'])
    expect(active.value).toBe('new')
    expect(editor.value!.canUndo).toBe(false)
    expect(editor.value!.getCommentAnchors()).toEqual({
      t1: { node: 'a' },
      t2: { edge: 'e' },
      done: { edge: 'e' },
      new: { node: 'b' },
    })
  })

  it('takes a removed thread off what it was about', async () => {
    const { wrapper, flow, threads } = setup()
    await ticks()
    await wrapper.findAll('.dou-flow-editor__comment')[0]!.trigger('click')
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', { type: 'remove', threadId: 't1' })
    await ticks()
    expect(flow.value.nodes[0]!.comments).toBeUndefined()
    expect(threads.value.map((t) => t.id)).toEqual(['t2', 'done'])
  })

  it('still takes comments while read-only', async () => {
    const { wrapper, editor, flow } = setup({ readonly: true }, ['b'])
    await ticks()
    expect(editor.value!.comment()).toBe(true)
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'r', comments: [{ id: 'r1', author: me, body: '审阅意见', createdAt: at }] },
    })
    await ticks()
    expect(flow.value.nodes[1]!.comments).toEqual(['r'])
    wrapper.find('[data-node-id="b"]').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await ticks()
    // reading still offers it, with copying
    const items = [...document.querySelectorAll('[role=menuitem]')].map((el) => el.textContent)
    expect(items[0]).toContain('评论')
  })

  it('opens a thread on a node with one rather than starting another', async () => {
    const { editor, active } = setup({}, ['a'])
    await ticks()
    expect(editor.value!.comment()).toBe(true)
    expect(active.value).toBe('t1')
  })

  it('reads threads without an author, and has no comments without the prop', async () => {
    const reader = setup({ author: undefined }, ['b'])
    await ticks()
    expect(reader.editor.value!.comment()).toBe(false)
    expect(reader.wrapper.findAll('.dou-flow-editor__comment')).toHaveLength(2)
    reader.wrapper.unmount()
    const none = setup({ comments: undefined }, ['a'])
    await ticks()
    expect(none.editor.value!.comment()).toBe(false)
    expect(none.wrapper.find('.dou-flow-editor__comments').exists()).toBe(false)
  })

  it('leaves the threads behind when a node is duplicated', async () => {
    const { wrapper, flow } = setup({}, ['a'])
    await ticks()
    await wrapper
      .find('.dou-flow-editor')
      .trigger('keydown', { key: 'd', code: 'KeyD', ctrlKey: true, metaKey: true })
    await ticks()
    expect(flow.value.nodes).toHaveLength(3)
    expect(flow.value.nodes[2]!.comments).toBeUndefined()
    expect(flow.value.nodes[0]!.comments).toEqual(['t1'])
  })

  it('opens a resolved thread from outside where an open one is too', async () => {
    const { active } = setup()
    await ticks()
    active.value = 'done'
    await ticks()
    const shown = card()!
    expect(shown.textContent).toContain('已经定了')
    // the open one there is shown with it, but only it is counted
    expect(shown.textContent).toContain('5000 元以下直接打款？')
    const marker = document.querySelectorAll('.dou-flow-editor__comment')[1]!
    expect(marker.getAttribute('aria-label')).toBe('1 条评论')
  })

  it('keeps a thread on a new node whose adding is undone and redone', async () => {
    const { wrapper, editor, flow } = setup()
    await ticks()
    const id = editor.value!.insertNode('default')!
    await ticks()
    expect(editor.value!.comment({ node: id })).toBe(true)
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'n', comments: [{ id: 'n1', author: me, body: '新节点', createdAt: at }] },
    })
    await ticks()
    editor.value!.undo()
    await ticks()
    expect(flow.value.nodes.some((n) => n.id === id)).toBe(false)
    editor.value!.redo()
    await ticks()
    expect(flow.value.nodes.find((n) => n.id === id)!.comments).toEqual(['n'])
    expect(editor.value!.getCommentAnchors().n).toEqual({ node: id })
  })

  it('marks what comments write, and comment() takes what to comment on', async () => {
    const metas: unknown[] = []
    const { wrapper, editor } = setup({
      onTransaction: (tr: { meta: unknown }) => metas.push(tr.meta),
    })
    await ticks()
    expect(editor.value!.comment({ node: 'nowhere' })).toBe(false)
    expect(editor.value!.comment({ edge: 'e' })).toBe(true)
    editor.value!.comment({ node: 'b' })
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'm', comments: [{ id: 'm1', author: me, body: '标记', createdAt: at }] },
    })
    await ticks()
    expect(metas.at(-1)).toMatchObject({ history: false, origin: 'comment' })
  })

  it('opens a marker without the reply box taking the focus, unless from the keyboard', async () => {
    const { wrapper } = setup()
    await ticks()
    const marker = () => wrapper.findAll('.dou-flow-editor__comment')[0]!.element
    marker().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await ticks()
    expect(card()!.contains(document.activeElement)).toBe(false)
    marker().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await ticks()
    marker().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await ticks()
    await new Promise((resolve) => setTimeout(resolve))
    await ticks()
    expect(card()!.contains(document.activeElement)).toBe(true)
  })

  it('offers commenting on the toolbar while read-only, and nothing else', async () => {
    const { wrapper } = setup({ readonly: true }, ['b'])
    await ticks()
    const buttons = wrapper.findAll('.dou-flow-toolbar button')
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(['评论'])
  })

  it('shows the threads in a collapsed group on the group', async () => {
    const flow = ref<FlowDocument>({
      version: 1,
      nodes: [
        {
          id: 'g',
          type: 'group',
          x: 0,
          y: 0,
          width: 400,
          height: 200,
          data: { label: '审批', collapsed: true },
        },
        { id: 'a', x: 24, y: 56, parent: 'g', data: { label: '主管审批' }, comments: ['t1'] },
      ],
      edges: [],
    })
    const active = ref<string | null>(null)
    const editor = ref<FlowEditorExpose>()
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouFlowEditor, {
            ref: editor,
            modelValue: flow.value,
            comments: [thread('t1', '复核要不要限时？')],
            activeComment: active.value,
            'onUpdate:activeComment': (value: string | null) => (active.value = value),
            author: me,
          }),
      ),
      { attachTo: document.body },
    )
    mounted.push(wrapper)
    await ticks()
    expect(wrapper.findAll('.dou-flow-editor__comment')).toHaveLength(1)
    active.value = 't1'
    await ticks()
    expect(document.querySelector('.dou-flow-editor__comment-card')!.textContent).toContain(
      '复核要不要限时？',
    )
    // commenting on the group opens what its marker shows
    active.value = null
    await ticks()
    expect(editor.value!.comment({ node: 'g' })).toBe(true)
    await ticks()
    expect(active.value).toBe('t1')
  })

  it('moves an edge marker aside from one it would cover', async () => {
    const { wrapper, flow } = setup()
    flow.value = {
      ...flow.value,
      edges: [...flow.value.edges, { ...flow.value.edges[0]!, id: 'f', comments: ['t1'] }],
    }
    await ticks()
    const xs = wrapper
      .findAll('.dou-flow-editor__comment:not(.is-node)')
      .map((m) => Number.parseFloat(m.attributes('style')!.match(/translate:\s*([-\d.]+)px/)![1]!))
    expect(xs).toHaveLength(2)
    expect(Math.abs(xs[0]! - xs[1]!)).toBeGreaterThanOrEqual(32)
  })

  it('gives the focus back to the card when it is panned back into view', async () => {
    const { wrapper, editor } = setup()
    await ticks()
    const marker = wrapper.findAll('.dou-flow-editor__comment')[0]!.element
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await ticks()
    await new Promise((resolve) => setTimeout(resolve))
    await ticks()
    expect(card()!.contains(document.activeElement)).toBe(true)
    editor.value!.setViewport({ x: -5000, y: 0, zoom: 1 })
    await ticks()
    expect(card()!.classList.contains('is-away')).toBe(true)
    // hidden, the card loses the focus
    ;(document.activeElement as HTMLElement).blur()
    editor.value!.setViewport({ x: 0, y: 0, zoom: 1 })
    await ticks()
    expect(card()!.contains(document.activeElement)).toBe(true)
  })
})

const pinned = (flow: { value: FlowDocument }) => {
  flow.value = {
    ...flow.value,
    nodes: flow.value.nodes.map((n) =>
      n.id === 'a'
        ? {
            ...n,
            comments: ['t1', 'p1', 'p2'],
            commentPins: { p1: { x: 0.5, y: 0.5 }, p2: { x: 1, y: 0 } },
          }
        : n,
    ),
  }
}
const pins = () => [...document.querySelectorAll<HTMLElement>('.dou-flow-editor__comment.is-pin')]
const xy = (el: HTMLElement) => el.style.translate.split(' ').map((v) => Number.parseFloat(v))

const press = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 5,
    pointerType: 'mouse',
  })

const touch = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 6,
    pointerType: 'touch',
  })

describe('DouFlowEditor pinned comments', () => {
  it("draws a numbered pin for each pinned thread, apart from the node's marker", async () => {
    const { flow, threads, active } = setup()
    threads.value = [...threads.value, thread('p1', '这里的按钮太小'), thread('p2', '右上角留白')]
    pinned(flow)
    await ticks()
    const labels = [...document.querySelectorAll('.dou-flow-editor__comment')].map((el) =>
      el.getAttribute('aria-label'),
    )
    // the node's marker counts only the thread about the whole node
    expect(labels).toEqual(['1 条评论', '评论 1，主管审批', '评论 2，主管审批', '1 条评论'])
    const [first, second] = pins()
    expect(first!.textContent).toBe('1')
    // on its point: the middle of the 200 × 60 node, and its top right corner
    expect(xy(first!)).toEqual([100, 30])
    expect(xy(second!)).toEqual([200, 0])
    second!.click()
    await ticks()
    expect(active.value).toBe('p2')
    expect(card()!.textContent).toContain('右上角留白')
    expect(card()!.textContent).not.toContain('这里的按钮太小')
  })

  it('moves and scales a pin with its node', async () => {
    const { flow, threads } = setup()
    threads.value = [...threads.value, thread('p1', '这里'), thread('p2', '那里')]
    pinned(flow)
    await ticks()
    flow.value = {
      ...flow.value,
      nodes: flow.value.nodes.map((n) => (n.id === 'a' ? { ...n, x: 40, y: 20 } : n)),
    }
    await ticks()
    expect(xy(pins()[0]!)).toEqual([140, 50])
  })

  it('starts a pinned thread with comment({ node, at }) even where one is open', async () => {
    const { wrapper, editor, flow, threads } = setup()
    await ticks()
    expect(editor.value!.comment({ node: 'a', at: { x: 0.25, y: 2 } })).toBe(true)
    await ticks()
    // the box is on the new pin, and a point off the node is kept on its edge
    expect(pins()).toHaveLength(1)
    expect(xy(pins()[0]!)).toEqual([50, 60])
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'np', comments: [{ id: 'np1', author: me, body: '截图左下', createdAt: at }] },
    })
    await ticks()
    const node = flow.value.nodes[0]!
    expect(node.comments).toEqual(['t1', 'np'])
    expect(node.commentPins).toEqual({ np: { x: 0.25, y: 1 } })
    expect(editor.value!.getCommentAnchors()).toMatchObject({
      t1: { node: 'a' },
      np: { node: 'a', at: { x: 0.25, y: 1 }, number: 1 },
    })
    expect(pins()[0]!.textContent).toBe('1')
    wrapper.findAllComponents(DouCommentThread)[0]!.vm.$emit('action', {
      type: 'remove',
      threadId: 'np',
    })
    await ticks()
    expect(flow.value.nodes[0]!.comments).toEqual(['t1'])
    expect(flow.value.nodes[0]!.commentPins).toBeUndefined()
    expect(threads.value.some((t) => t.id === 'np')).toBe(false)
  })

  it('leaves a plain thread on a node without pins as it was', async () => {
    const { wrapper, editor, flow } = setup()
    await ticks()
    editor.value!.comment({ node: 'b' })
    await ticks()
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'w', comments: [{ id: 'w1', author: me, body: '整个节点', createdAt: at }] },
    })
    await ticks()
    expect('commentPins' in flow.value.nodes[1]!).toBe(false)
  })

  it('pins a thread where a node is clicked with the whiteboard comment tool', async () => {
    const tool = ref<WhiteboardTool>('select')
    const { wrapper, editor } = setup({
      extensions: [flowKit(), whiteboardKit({ tool })],
      readonly: true,
    })
    await ticks()
    const root = wrapper.find('.dou-flow-editor').element
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }))
    await ticks()
    expect(tool.value).toBe('comment')
    // read-only, the toolbar offers only what can be done: select, hand and comment
    const buttons = [...document.querySelectorAll('.dou-whiteboard-toolbar button')]
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['选择', '移动画布', '评论'])
    const node = wrapper.find('[data-node-id="b"]').element
    node.dispatchEvent(press('pointerdown', 350, 15))
    root.dispatchEvent(press('pointerup', 350, 15))
    await ticks()
    expect(wrapper.findComponent(DouCommentThread).props('thread')).toBe(null)
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'wb', comments: [{ id: 'wb1', author: me, body: '这里', createdAt: at }] },
    })
    await ticks()
    expect(editor.value!.getCommentAnchors().wb).toEqual({
      node: 'b',
      at: { x: 0.25, y: 0.25 },
      number: 1,
    })
    // the empty canvas does nothing, nor does a drag
    root.dispatchEvent(press('pointerdown', 700, 500))
    root.dispatchEvent(press('pointerup', 700, 500))
    node.dispatchEvent(press('pointerdown', 320, 10))
    root.dispatchEvent(press('pointermove', 380, 40))
    root.dispatchEvent(press('pointerup', 380, 40))
    await ticks()
    expect(document.querySelector('.dou-flow-editor__comment.is-new')).toBe(null)
    expect(pins()).toHaveLength(1)
  })

  it('has no comment tool when threads cannot be started', async () => {
    const tool = ref<WhiteboardTool>('comment')
    const { wrapper } = setup({
      extensions: [flowKit(), whiteboardKit({ tool })],
      author: undefined,
    })
    await ticks()
    expect(tool.value).toBe('select')
    const labels = [...document.querySelectorAll('.dou-whiteboard-toolbar button')].map((b) =>
      b.getAttribute('aria-label'),
    )
    expect(labels).not.toContain('评论')
    wrapper
      .find('.dou-flow-editor')
      .element.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }))
    await ticks()
    expect(tool.value).toBe('select')
  })

  it('keeps the numbers of the other pins when one is resolved', async () => {
    const { flow, threads, editor } = setup()
    threads.value = [...threads.value, thread('p1', '这里'), thread('p2', '那里')]
    pinned(flow)
    await ticks()
    threads.value = threads.value.map((t) =>
      t.id === 'p1' ? { ...t, resolved: { by: me, at } } : t,
    )
    await ticks()
    expect(pins().map((el) => el.textContent)).toEqual(['2'])
    expect(editor.value!.getCommentAnchors().p2).toMatchObject({ number: 2 })
  })

  it('keeps the card of a pin started by a tap open through the click that follows', async () => {
    const { editor } = setup()
    await ticks()
    editor.value!.comment({ node: 'a', at: { x: 0.5, y: 0.5 } })
    await ticks()
    // the click the browser makes from the tap lands on the new pin under the finger
    pins()[0]!.click()
    await ticks()
    expect(card()).not.toBe(null)
  })

  it('opens the card of a pin started by a tap without the focus, so no keyboard comes up', async () => {
    const tool = ref<WhiteboardTool>('comment')
    const { wrapper } = setup({ extensions: [flowKit(), whiteboardKit({ tool })] })
    await ticks()
    const root = wrapper.find('.dou-flow-editor').element
    const node = wrapper.find('[data-node-id="b"]').element
    node.dispatchEvent(touch('pointerdown', 350, 15))
    root.dispatchEvent(touch('pointerup', 350, 15))
    await ticks()
    await new Promise((resolve) => setTimeout(resolve))
    await ticks()
    expect(card()).not.toBe(null)
    expect(card()!.contains(document.activeElement)).toBe(false)
  })

  it('starts a thread on a node without the focus when asked to', async () => {
    const { editor } = setup()
    await ticks()
    expect(editor.value!.comment({ node: 'b' }, { focus: false })).toBe(true)
    await ticks()
    await new Promise((resolve) => setTimeout(resolve))
    await ticks()
    expect(card()).not.toBe(null)
    expect(card()!.contains(document.activeElement)).toBe(false)
  })

  it('puts the focus in the reply box of a pin started with a mouse', async () => {
    const tool = ref<WhiteboardTool>('comment')
    const { wrapper } = setup({ extensions: [flowKit(), whiteboardKit({ tool })] })
    await ticks()
    const root = wrapper.find('.dou-flow-editor').element
    const node = wrapper.find('[data-node-id="b"]').element
    node.dispatchEvent(press('pointerdown', 350, 15))
    root.dispatchEvent(press('pointerup', 350, 15))
    await ticks()
    await new Promise((resolve) => setTimeout(resolve))
    await ticks()
    expect(card()!.contains(document.activeElement)).toBe(true)
  })

  it('starts a thread on the selected node with Enter under the comment tool', async () => {
    const tool = ref<WhiteboardTool>('comment')
    const { wrapper, editor } = setup({ extensions: [flowKit(), whiteboardKit({ tool })] }, ['b'])
    await ticks()
    wrapper
      .find('.dou-flow-editor')
      .element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await ticks()
    expect(wrapper.findComponent(DouCommentThread).props('thread')).toBe(null)
    wrapper.findComponent(DouCommentThread).vm.$emit('action', {
      type: 'create',
      thread: { id: 'k', comments: [{ id: 'k1', author: me, body: '键盘', createdAt: at }] },
    })
    await ticks()
    expect(editor.value!.getCommentAnchors().k).toEqual({ node: 'b' })
  })

  it('moves the view when a finger drags under the comment tool', async () => {
    const tool = ref<WhiteboardTool>('comment')
    const { wrapper, editor } = setup({ extensions: [flowKit(), whiteboardKit({ tool })] })
    await ticks()
    const root = wrapper.find('.dou-flow-editor').element
    const before = editor.value!.toCanvas({ x: 0, y: 0 })
    root.dispatchEvent(touch('pointerdown', 600, 400))
    root.dispatchEvent(touch('pointermove', 640, 430))
    root.dispatchEvent(touch('pointerup', 640, 430))
    await ticks()
    const after = editor.value!.toCanvas({ x: 0, y: 0 })
    expect(before.x - after.x).toBe(40)
    expect(before.y - after.y).toBe(30)
  })
})
