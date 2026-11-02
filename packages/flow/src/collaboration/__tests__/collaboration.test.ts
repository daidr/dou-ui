import { mount, type VueWrapper } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { collaboration, fillMaps } from '..'
import {
  DouFlowEditor,
  defineNodeType,
  type FlowDocument,
  type FlowEditorExpose,
  type FlowSelection,
} from '../../index'

const START = (): FlowDocument => ({
  version: 1,
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: '读取笔记', outputs: [{ id: 'out' }] } },
    {
      id: 'b',
      x: 288,
      y: 0,
      data: { label: '生成摘要', inputs: [{ id: 'in' }], outputs: [{ id: 'out' }] },
    },
    { id: 'g', type: 'group', x: 560, y: -40, width: 280, height: 160, data: { label: '发出' } },
    { id: 'c', x: 584, y: 16, parent: 'g', data: { label: '发布', inputs: [{ id: 'in' }] } },
  ],
  edges: [
    { id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
    { id: 'bc', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' } },
  ],
})

// jsdom lays nothing out: an element is as large as its style says, or 200 × 60.
const descriptors = new Map<string, PropertyDescriptor | undefined>()
const sizes: Record<string, (el: HTMLElement) => number> = {
  offsetWidth: (el) => parseFloat(el.style.width) || 200,
  offsetHeight: (el) => parseFloat(el.style.height) || 60,
  clientWidth: () => 1200,
  clientHeight: () => 800,
}
beforeAll(() => {
  for (const [key, size] of Object.entries(sizes)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key))
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get(this: HTMLElement) {
        return size(this)
      },
    })
  }
})
afterAll(() => {
  for (const [key, descriptor] of descriptors)
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
})

const wrappers: VueWrapper[] = []
const awarenesses: Awareness[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  for (const awareness of awarenesses.splice(0)) awareness.destroy()
  document.body.innerHTML = ''
})

const ticks = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

/** A client: its own Y.Doc and an editor bound to it, starting from `start`. */
/** A node drawn turned by `data.rotation`, as a whiteboard node is. */
const turnedNode = defineNodeType<{ rotation?: number }>({
  type: 'turned',
  component: defineComponent(() => () => h('div')),
  rotation: (node) => node.data?.rotation ?? 0,
})

function client(start: FlowDocument, options: { doc?: Y.Doc; awareness?: boolean } = {}) {
  const doc = options.doc ?? new Y.Doc()
  const awareness = options.awareness ? new Awareness(doc) : undefined
  if (awareness) awarenesses.push(awareness)
  const state = {
    flow: ref(start),
    selection: ref<FlowSelection>({ nodes: [], edges: [] }),
  }
  const editor = ref<FlowEditorExpose>()
  const extensions = [
    collaboration({
      nodes: doc.getMap('nodes'),
      edges: doc.getMap('edges'),
      awareness,
      user: { name: `用户 ${doc.clientID}` },
    }),
  ]
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          ref: editor,
          modelValue: state.flow.value,
          'onUpdate:modelValue': (value: FlowDocument) => (state.flow.value = value),
          selection: state.selection.value,
          'onUpdate:selection': (value: FlowSelection) => (state.selection.value = value),
          // written inline, so it is a new list on every render
          extensions: [extensions, []],
          nodeTypes: [turnedNode],
        }),
    ),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  const node = (id: string) => state.flow.value.nodes.find((item) => item.id === id)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const edgeIds = () => state.flow.value.edges.map((edge) => edge.id).sort()
  return { doc, awareness, wrapper, editor, node, edgeIds, ...state }
}

/** Relays updates between two docs, like a server would; the line can be cut. */
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

/** Two editors on one flow: the first brings the nodes. */
async function pair() {
  const one = client(START())
  await ticks()
  const two = client({ version: 1, nodes: [], edges: [] })
  const line = connect(one.doc, two.doc)
  await ticks()
  return { one, two, line }
}

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 7 })

describe('collaboration', () => {
  it('fills empty maps from the first editor and loads them in the others', async () => {
    const { two } = await pair()
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    expect(two.flow.value.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'g'])
    expect(two.node('c')).toMatchObject({ x: 584, y: 16, parent: 'g' })
    expect(two.edgeIds()).toEqual(['ab', 'bc'])
    expect(two.wrapper.findAll('[data-node-id]')).toHaveLength(4)
  })

  it('sends each change to the others', async () => {
    const { one, two } = await pair()
    one.editor.value!.transact((tr) => tr.updateData('a', { label: '读取今天的笔记' }))
    expect(two.node('a')!.data!.label).toBe('读取今天的笔记')
    two.editor.value!.transact((tr) => tr.moveNode('b', 320, 24))
    expect(one.node('b')).toMatchObject({ x: 320, y: 24 })
    one.editor.value!.transact((tr) => tr.removeNode('b'))
    expect(two.node('b')).toBeUndefined()
    expect(two.edgeIds()).toEqual([])
  })

  it('undoes only this user’s own changes', async () => {
    const { one, two } = await pair()
    one.editor.value!.transact((tr) => tr.updateData('a', { label: '读取今天的笔记' }))
    two.editor.value!.transact((tr) => tr.updateData('b', { label: '写成摘要' }))
    expect(one.editor.value!.canUndo).toBe(true)
    expect(one.editor.value!.undo()).toBe(true)
    expect(two.node('a')!.data!.label).toBe('读取笔记')
    // the other person's change stays
    expect(one.node('b')!.data!.label).toBe('写成摘要')
    expect(one.editor.value!.canUndo).toBe(false)
    expect(one.editor.value!.redo()).toBe(true)
    expect(two.node('a')!.data!.label).toBe('读取今天的笔记')
  })

  it('keeps both changes when two people change different fields of a node offline', async () => {
    const { one, two, line } = await pair()
    line.offline()
    one.editor.value!.transact((tr) => tr.updateData('b', { label: '写成摘要' }))
    two.editor.value!.transact((tr) => tr.moveNode('b', 320, 80))
    line.online()
    for (const side of [one, two])
      expect(side.node('b')).toMatchObject({ x: 320, y: 80, data: { label: '写成摘要' } })
  })

  it('clears edges to a node someone else removed', async () => {
    const { one, two, line } = await pair()
    line.offline()
    one.editor.value!.transact((tr) => tr.removeNode('c'))
    two.editor.value!.transact((tr) =>
      tr.addEdge({
        id: 'ac',
        source: { node: 'a', port: 'out' },
        target: { node: 'c', port: 'in' },
      }),
    )
    line.online()
    await ticks()
    for (const side of [one, two]) expect(side.edgeIds()).toEqual(['ab'])
    expect(one.doc.getMap('edges').has('ac')).toBe(false)
  })

  it("warns once about data the others can't get", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { one } = await pair()
      const icon = { name: 'Icon', render: () => null }
      one.editor.value!.transact((tr) => tr.updateData('a', { icon }))
      one.editor.value!.transact((tr) => tr.updateData('a', { icon, label: '读取周报' }))
      const calls = warn.mock.calls.filter(([text]) => String(text).includes('data.icon'))
      expect(calls).toHaveLength(1)
      expect(String(calls[0]![0])).toContain('"a"')
    } finally {
      warn.mockRestore()
    }
  })

  it('keeps folding a group to each person', async () => {
    const { one, two } = await pair()
    one.editor.value!.transact((tr) => tr.updateData('g', { collapsed: true }))
    expect(one.node('g')!.data!.collapsed).toBe(true)
    expect(two.node('g')!.data!.collapsed).toBeUndefined()
    two.editor.value!.transact((tr) => tr.updateData('g', { label: '发给团队' }))
    expect(one.node('g')!.data).toEqual({ label: '发给团队', collapsed: true })
  })

  it('writes a drag once it ends, as one undo step', async () => {
    const { one, two } = await pair()
    const root = one.wrapper.find('.dou-flow-editor').element
    one.wrapper.find('[data-node-id="a"]').element.dispatchEvent(pointer('pointerdown', 50, 20))
    await ticks()
    for (const x of [80, 120, 150]) root.dispatchEvent(pointer('pointermove', x, 20))
    await ticks()
    expect(one.node('a')!.x).toBeGreaterThan(0)
    // the others don't see the drag in the document yet
    expect(two.node('a')!.x).toBe(0)
    root.dispatchEvent(pointer('pointerup', 150, 20))
    await ticks()
    expect(two.node('a')!.x).toBe(one.node('a')!.x)
    one.editor.value!.undo()
    expect(one.node('a')!.x).toBe(0)
    expect(two.node('a')!.x).toBe(0)
  })

  it('keeps what the others changed during a drag', async () => {
    const { one, two } = await pair()
    const root = one.wrapper.find('.dou-flow-editor').element
    one.wrapper.find('[data-node-id="a"]').element.dispatchEvent(pointer('pointerdown', 50, 20))
    await ticks()
    for (const x of [80, 120, 150]) root.dispatchEvent(pointer('pointermove', x, 20))
    await ticks()
    two.editor.value!.transact((tr) => tr.updateData('a', { label: '读取周报' }))
    two.editor.value!.transact((tr) => tr.moveNode('b', 300, 200))
    await ticks()
    // the label and the other node arrive while dragging
    expect(one.node('a')!.data!.label).toBe('读取周报')
    expect(one.node('b')).toMatchObject({ x: 300, y: 200 })
    root.dispatchEvent(pointer('pointerup', 150, 20))
    await ticks()
    for (const side of [one, two])
      expect(side.node('a')).toMatchObject({ x: one.node('a')!.x, data: { label: '读取周报' } })
    expect(one.node('a')!.x).toBeGreaterThan(0)
  })

  it('writes nothing when a drag is cancelled', async () => {
    const { one, two } = await pair()
    const root = one.wrapper.find('.dou-flow-editor').element
    one.wrapper.find('[data-node-id="a"]').element.dispatchEvent(pointer('pointerdown', 50, 20))
    await ticks()
    for (const x of [80, 120, 150]) root.dispatchEvent(pointer('pointermove', x, 20))
    await ticks()
    let updates = 0
    one.doc.on('update', () => updates++)
    one.wrapper
      .find('[data-node-id="a"]')
      .element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await ticks()
    root.dispatchEvent(pointer('pointerup', 150, 20))
    await ticks()
    expect(one.node('a')!.x).toBe(0)
    expect(two.node('a')!.x).toBe(0)
    expect(updates).toBe(0)
    expect(one.editor.value!.canUndo).toBe(false)
  })

  it('shows what the others select and drag', async () => {
    const doc = new Y.Doc()
    fillMaps({ nodes: doc.getMap('nodes'), edges: doc.getMap('edges') }, START())
    const one = client({ version: 1, nodes: [], edges: [] }, { doc, awareness: true })
    const other = new Y.Doc()
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc))
    const two = client({ version: 1, nodes: [], edges: [] }, { doc: other, awareness: true })
    await ticks()
    two.selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    const relay = () =>
      applyAwarenessUpdate(
        one.awareness!,
        encodeAwarenessUpdate(two.awareness!, [two.awareness!.clientID]),
        'relay',
      )
    relay()
    await ticks()
    const selected = one.wrapper.find('.dou-flow-peer.is-selected')
    expect(selected.exists()).toBe(true)
    expect(selected.text()).toBe(`用户 ${other.clientID}`)

    // two starts dragging b: one sees a dashed outline where it would land
    const root = two.wrapper.find('.dou-flow-editor').element
    two.wrapper.find('[data-node-id="b"]').element.dispatchEvent(pointer('pointerdown', 300, 20))
    await ticks()
    for (const x of [340, 380]) root.dispatchEvent(pointer('pointermove', x, 20))
    await ticks()
    relay()
    await ticks()
    const moving = one.wrapper.find('.dou-flow-peer.is-moving')
    expect(moving.exists()).toBe(true)
    expect(moving.attributes('style')).toContain(`translate: ${two.node('b')!.x}px`)
    expect(one.node('b')!.x).toBe(288)
    root.dispatchEvent(pointer('pointerup', 380, 20))
    await ticks()
    relay()
    await ticks()
    expect(one.wrapper.find('.dou-flow-peer.is-moving').exists()).toBe(false)
  })

  it('turns the outline of a turned node the others select', async () => {
    const doc = new Y.Doc()
    const start: FlowDocument = {
      version: 1,
      nodes: [
        { id: 't', type: 'turned', x: 200, y: 40, width: 160, height: 90, data: { rotation: 30 } },
      ],
      edges: [],
    }
    fillMaps({ nodes: doc.getMap('nodes'), edges: doc.getMap('edges') }, start)
    const one = client({ version: 1, nodes: [], edges: [] }, { doc, awareness: true })
    const other = new Y.Doc()
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc))
    const two = client({ version: 1, nodes: [], edges: [] }, { doc: other, awareness: true })
    await ticks()
    two.selection.value = { nodes: ['t'], edges: [] }
    await ticks()
    applyAwarenessUpdate(
      one.awareness!,
      encodeAwarenessUpdate(two.awareness!, [two.awareness!.clientID]),
      'relay',
    )
    await ticks()
    const selected = one.wrapper.find('.dou-flow-peer.is-selected')
    // placed, then turned about its own centre, as the node is drawn
    expect(selected.attributes('style')).toContain('translate: 200px 40px')
    expect(selected.attributes('style')).toContain('rotate: 30deg')
    expect(selected.attributes('style')).not.toContain('transform')
    // the name stays upright
    expect(selected.find('.dou-flow-peer__name').attributes('style')).toContain('rotate: -30deg')
  })
})
