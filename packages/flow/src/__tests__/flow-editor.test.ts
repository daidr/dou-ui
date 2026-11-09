import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  defineNodeType,
  DouFlowControls,
  DouFlowEditor,
  DouFlowPort,
  useFlowMessages,
} from '../index'
import type { FlowDocument, FlowMessages, FlowSelection } from '../index'

const sample = (): FlowDocument => ({
  version: 1,
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: '收集素材', outputs: [{ id: 'out' }] } },
    { id: 'b', x: 288, y: 0, data: { label: '写初稿', inputs: [{ id: 'in' }] } },
    { id: 'c', x: 288, y: 160, locked: true, data: { label: '发布' } },
  ],
  edges: [{ id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
})

function setup(selected: FlowSelection = { nodes: [], edges: [] }) {
  const doc = ref(sample())
  const selection = ref(selected)
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouFlowEditor,
          {
            modelValue: doc.value,
            'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
            selection: selection.value,
            'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
            ariaLabel: '写作流程',
          },
          () => h(DouFlowControls),
        ),
    ),
    { attachTo: document.body },
  )
  const root = wrapper.find('.dou-flow-editor')
  return { wrapper, root, doc, selection }
}

/** Whether a `selectstart` from `target` was cancelled. */
function selectstart(target: Node) {
  const event = new Event('selectstart', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

describe('DouFlowEditor', () => {
  it('renders nodes with their ports and an accessible name', () => {
    const { wrapper, root } = setup()
    expect(root.attributes('role')).toBe('application')
    expect(root.attributes('aria-label')).toBe('写作流程')
    const nodes = wrapper.findAll('[data-node-id]')
    expect(nodes.map((n) => n.attributes('aria-label'))).toEqual(['收集素材', '写初稿', '发布'])
    expect(nodes[0]!.attributes('aria-roledescription')).toBe('节点')
    expect(nodes[0]!.find('[data-port="out"]').classes()).toContain('is-connected')
    expect(nodes[0]!.attributes('style')).toContain('translate(0px, 0px)')
    wrapper.unmount()
  })

  it('starts no text selection on the canvas, only in fields and nodrag parts', () => {
    const { wrapper, root } = setup()
    const node = wrapper.find('[data-node-id="a"]').element
    // The text node itself, as a browser sends it.
    expect(selectstart(node.querySelector('*')!.firstChild ?? node)).toBe(true)
    expect(selectstart(root.element)).toBe(true)
    const field = document.createElement('input')
    node.append(field)
    expect(selectstart(field)).toBe(false)
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    editable.textContent = '备注'
    node.append(editable)
    expect(selectstart(editable.firstChild!)).toBe(false)
    const output = document.createElement('pre')
    output.dataset.douNodrag = ''
    output.textContent = '运行结果'
    node.append(output)
    expect(selectstart(output.firstChild!)).toBe(false)
    wrapper.unmount()
  })

  it('deletes the selection with its edges, and undoes it', async () => {
    const { wrapper, root, doc, selection } = setup({ nodes: ['a', 'c'], edges: [] })
    await root.trigger('keydown', { key: 'Delete' })
    // The locked node stays.
    expect(doc.value.nodes.map((n) => n.id)).toEqual(['b', 'c'])
    expect(doc.value.edges).toEqual([])
    expect(selection.value.nodes).toEqual(['c'])
    await root.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(doc.value).toEqual(sample())
    expect(selection.value.nodes).toEqual(['a', 'c'])
    await root.trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(doc.value.nodes.map((n) => n.id)).toEqual(['b', 'c'])
    wrapper.unmount()
  })

  it('moves selected nodes with the arrow keys, as one undo step', async () => {
    const { wrapper, root, doc } = setup({ nodes: ['b'], edges: [] })
    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(doc.value.nodes[1]).toMatchObject({ x: 296, y: 32 })
    await root.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(doc.value.nodes[1]).toMatchObject({ x: 288, y: 0 })
    wrapper.unmount()
  })

  it('moves focus between nodes in reading order with Tab', async () => {
    const { wrapper, root, selection } = setup()
    ;(root.element as HTMLElement).focus()
    await root.trigger('keydown', { key: 'Tab' })
    expect((document.activeElement as HTMLElement).dataset.nodeId).toBe('a')
    expect(selection.value.nodes).toEqual(['a'])
    await wrapper.find('[data-node-id="a"]').trigger('keydown', { key: 'Tab' })
    expect((document.activeElement as HTMLElement).dataset.nodeId).toBe('b')
    await wrapper.find('[data-node-id="b"]').trigger('keydown', { key: 'Tab', shiftKey: true })
    expect((document.activeElement as HTMLElement).dataset.nodeId).toBe('a')
    wrapper.unmount()
  })

  it('selects all with Ctrl+A and clears with Escape', async () => {
    const { wrapper, root, selection } = setup()
    await root.trigger('keydown', { key: 'a', ctrlKey: true })
    expect(selection.value.nodes).toEqual(['a', 'b', 'c'])
    await root.trigger('keydown', { key: 'Escape' })
    expect(selection.value.nodes).toEqual([])
    wrapper.unmount()
  })

  it('leaves keys typed into a node alone', async () => {
    const Field = defineNodeType({
      type: 'field',
      component: defineComponent(() => () => h('input', { class: 'field' })),
    })
    const doc = ref<FlowDocument>({
      version: 1,
      nodes: [{ id: 'f', type: 'field', x: 0, y: 0 }],
      edges: [],
    })
    const wrapper = mount(DouFlowEditor, {
      props: {
        modelValue: doc.value,
        'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
        selection: { nodes: ['f'], edges: [] },
        nodeTypes: [Field],
      },
    })
    await wrapper.find('.field').trigger('keydown', { key: 'Backspace' })
    expect(doc.value.nodes).toHaveLength(1)
    wrapper.unmount()
  })

  it('places ports the component leaves out, and updates data', async () => {
    const Note = defineNodeType<{ text: string }>({
      type: 'note',
      ports: [
        { id: 'in', kind: 'input' },
        { id: 'out', kind: 'output' },
        { id: 'below', kind: 'output', side: 'bottom' },
      ],
      component: defineComponent({
        props: ['data', 'updateData'],
        setup: (props) => () =>
          h('div', [
            h('button', { class: 'edit', onClick: () => props.updateData({ text: 'b' }) }),
            h(DouFlowPort, { id: 'out' }),
          ]),
      }),
    })
    const doc = ref<FlowDocument>({
      version: 1,
      nodes: [{ id: 'n', type: 'note', x: 0, y: 0, data: { text: 'a' } }],
      edges: [],
    })
    const wrapper = mount(DouFlowEditor, {
      props: {
        modelValue: doc.value,
        'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
        nodeTypes: [Note],
      },
    })
    await nextTick()
    await nextTick()
    const auto = wrapper.findAll('.dou-flow-port.is-auto').map((p) => p.attributes('data-port'))
    expect(auto).toEqual(['in', 'below'])
    expect(wrapper.find('.dou-flow-port.is-bottom').exists()).toBe(true)
    await wrapper.find('.edit').trigger('click')
    expect(doc.value.nodes[0]!.data).toEqual({ text: 'b' })
    wrapper.unmount()
  })

  it('marks ports that show only on hover or while connecting', async () => {
    const Pending = defineNodeType({
      type: 'pending',
      ports: 'sides',
      frame: false,
      component: defineComponent({
        setup: () => () =>
          h('div', [
            h(DouFlowPort, { id: 'top', visible: 'hover' }),
            h(DouFlowPort, { id: 'top-in', visible: 'connecting' }),
            h(DouFlowPort, { id: 'left', visible: 'always' }),
            h(DouFlowPort, { id: 'right' }),
          ]),
      }),
    })
    const wrapper = mount(DouFlowEditor, {
      props: {
        modelValue: {
          version: 1,
          nodes: [{ id: 'p', type: 'pending', x: 0, y: 0, data: {} }],
          edges: [],
        },
        nodeTypes: [Pending],
      },
    })
    await nextTick()
    const visible = (id: string) =>
      wrapper.find(`.dou-flow-port[data-port="${id}"]`).attributes('data-visible')
    expect(visible('top')).toBe('hover')
    expect(visible('top-in')).toBe('connecting')
    expect(visible('left')).toBeUndefined()
    expect(visible('right')).toBeUndefined()
    wrapper.unmount()
  })

  it('applies transactions from outside and reports them', () => {
    const changes: string[] = []
    const doc = ref(sample())
    const wrapper = mount(DouFlowEditor, {
      props: {
        modelValue: doc.value,
        'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
        onTransaction: (tr) => changes.push(...tr.steps.map((s) => s.type)),
      },
    })
    wrapper.vm.transact((tr) => tr.removeNode('b'))
    expect(changes).toEqual(['removeEdge', 'removeNode'])
    expect(wrapper.vm.canUndo).toBe(true)
    wrapper.vm.undo()
    expect(doc.value).toEqual(sample())
    wrapper.unmount()
  })

  it('connects from the keyboard and announces the target', async () => {
    const { wrapper, root, doc } = setup({ nodes: ['a'], edges: [] })
    doc.value = { ...doc.value, edges: [] }
    await nextTick()
    await root.trigger('keydown', { key: 'c' })
    expect(wrapper.find('[aria-live]').text()).toContain('写初稿')
    await root.trigger('keydown', { key: 'Enter' })
    expect(doc.value.edges).toHaveLength(1)
    expect(doc.value.edges[0]).toMatchObject({
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
    })
    wrapper.unmount()
  })

  it('copies, pastes and duplicates nodes with the edges between them', async () => {
    const { wrapper, root, doc, selection } = setup({ nodes: ['a', 'b'], edges: [] })
    ;(root.element as HTMLElement).focus()
    const clipboard = new DataTransfer()
    document.dispatchEvent(new ClipboardEvent('copy', { clipboardData: clipboard }))
    const text = clipboard.getData('text/plain')
    expect(JSON.parse(text).nodes).toHaveLength(2)
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard }))
    await nextTick()
    expect(doc.value.nodes).toHaveLength(5)
    expect(doc.value.edges).toHaveLength(2)
    const pasted = doc.value.nodes.slice(3)
    expect(pasted.map((n) => n.data?.label)).toEqual(['收集素材', '写初稿'])
    expect(pasted[0]).toMatchObject({ x: 24, y: 24 })
    expect(selection.value.nodes).toEqual(pasted.map((n) => n.id))
    await root.trigger('keydown', { key: 'd', ctrlKey: true })
    expect(doc.value.nodes).toHaveLength(7)
    wrapper.unmount()
  })

  it('marks edges whose port types stopped matching, and removes them', async () => {
    const Variable = defineNodeType<{ type: string }>({
      type: 'variable',
      ports: (node) => [{ id: 'value', kind: 'output', dataType: node.data!.type }],
      component: defineComponent(() => () => h('div')),
    })
    const doc = ref<FlowDocument>({
      version: 1,
      nodes: [
        { id: 'v', type: 'variable', x: 0, y: 0, data: { type: 'number' } },
        { id: 'n', x: 300, y: 0, data: { inputs: [{ id: 'in', dataType: 'number' }] } },
      ],
      edges: [{ id: 'e', source: { node: 'v', port: 'value' }, target: { node: 'n', port: 'in' } }],
    })
    const wrapper = mount(DouFlowEditor, {
      props: {
        modelValue: doc.value,
        'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
        nodeTypes: [Variable],
      },
    })
    expect(wrapper.vm.staleEdges).toEqual([])
    wrapper.vm.transact((tr) => tr.updateData('v', { type: 'text' }))
    await wrapper.setProps({ modelValue: doc.value })
    expect(wrapper.vm.staleEdges).toEqual(['e'])
    await nextTick()
    await nextTick()
    expect(wrapper.find('[aria-live]').text()).toContain('1 条连线')
    expect(wrapper.vm.removeStaleEdges()).toBe(1)
    expect(doc.value.edges).toEqual([])
    wrapper.unmount()
  })

  it('pans with one finger after a pinch whose finger lifted outside the editor', async () => {
    const { wrapper, root } = setup()
    const editor = wrapper.findComponent(DouFlowEditor)
    const touch = (type: string, pointerId: number, x: number, y: number, isPrimary = false) =>
      root.trigger(type, {
        pointerType: 'touch',
        pointerId,
        isPrimary,
        clientX: x,
        clientY: y,
        button: 0,
      })
    await touch('pointerdown', 1, 100, 100, true)
    await touch('pointerdown', 2, 200, 100)
    await touch('pointermove', 2, 300, 100)
    // The second finger lifts outside the editor: its pointerup never arrives.
    await touch('pointerup', 1, 100, 100, true)
    const zoom = (editor.vm as any).viewport?.zoom ?? 1
    const before = editor.emitted('update:viewport')?.at(-1)?.[0] as { zoom: number }
    // A new one-finger drag pans and keeps the zoom.
    await touch('pointerdown', 3, 100, 100, true)
    await touch('pointermove', 3, 160, 140, true)
    await touch('pointermove', 3, 220, 180, true)
    const after = editor.emitted('update:viewport')?.at(-1)?.[0] as {
      x: number
      y: number
      zoom: number
    }
    expect(after.zoom).toBe(before?.zoom ?? zoom)
    expect(after.x - (before as any).x).toBe(120)
    wrapper.unmount()
  })

  it('merges message overrides by group', () => {
    let messages!: FlowMessages
    mount(
      defineComponent(() => {
        const m = useFlowMessages({ node: '步骤', refused: { cycle: '不能绕回去' } })
        messages = m.value
        return () => h('div')
      }),
    )
    expect(messages.node).toBe('步骤')
    expect(messages.refused.cycle).toBe('不能绕回去')
    expect(messages.refused.type).toBe('端口类型不匹配')
  })
})
