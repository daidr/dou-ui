import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { defineNodeType, DouFlowControls, DouFlowEditor, DouFlowPort } from '../index'
import type { FlowDocument, FlowSelection } from '../index'

const sample = (): FlowDocument => ({
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
            label: '写作流程',
          },
          () => h(DouFlowControls),
        ),
    ),
    { attachTo: document.body },
  )
  const root = wrapper.find('.dou-flow-editor')
  return { wrapper, root, doc, selection }
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
    const doc = ref<FlowDocument>({ nodes: [{ id: 'f', type: 'field', x: 0, y: 0 }], edges: [] })
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

  it('applies transactions from outside and reports them', () => {
    const changes: string[] = []
    const doc = ref(sample())
    const wrapper = mount(DouFlowEditor, {
      props: {
        modelValue: doc.value,
        'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
        onChange: (tr) => changes.push(...tr.steps.map((s) => s.type)),
      },
    })
    wrapper.vm.transact((tr) => tr.removeNode('b'))
    expect(changes).toEqual(['removeEdge', 'removeNode'])
    expect(wrapper.vm.canUndo).toBe(true)
    wrapper.vm.undo()
    expect(doc.value).toEqual(sample())
    wrapper.unmount()
  })
})
