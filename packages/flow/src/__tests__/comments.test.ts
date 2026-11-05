import { mount } from '@vue/test-utils'
import { DouCommentThread, type CommentAction, type CommentThread } from 'dou-ui'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouFlowEditor, type FlowEditorExpose } from '../index'
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
    const card = document.querySelector('.dou-flow-editor__comment-card')!
    expect(card.textContent).toContain('5000 元以下直接打款？')
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
})
