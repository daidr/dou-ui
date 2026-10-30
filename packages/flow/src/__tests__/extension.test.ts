import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  defineFlowExtension,
  defineNodeType,
  DouFlowEditor,
  DouFlowMinimap,
  flowKit,
  resolveFlowExtensions,
  useFlowEditor,
} from '../index'
import type { FlowDocument, FlowExtension, FlowSelection } from '../index'

const sample = (): FlowDocument => ({
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: '收集素材', outputs: [{ id: 'out' }] } },
    { id: 'b', x: 288, y: 120, data: { label: '写初稿', inputs: [{ id: 'in' }] } },
    { id: 'c', x: 40, y: 400, locked: true, data: { label: '发布' } },
  ],
  edges: [{ id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
})

function setup(
  extensions?: (FlowExtension | FlowExtension[])[],
  selected: FlowSelection = { nodes: [], edges: [] },
) {
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
            extensions,
          },
          () => h(DouFlowMinimap),
        ),
    ),
    { attachTo: document.body },
  )
  const root = wrapper.find('.dou-flow-editor')
  const editor = wrapper.findComponent(DouFlowEditor)
  return { wrapper, root, editor, doc, selection }
}

describe('flow extensions', () => {
  it('sorts by priority, keeping the given order for ties', () => {
    const resolved = resolveFlowExtensions([
      { name: 'a', keymap: () => ({}) },
      [{ name: 'b', priority: 200, keymap: () => ({}) }],
      { name: 'c', keymap: () => ({}) },
    ])
    expect(resolved.extensions.map((e) => e.name)).toEqual(['b', 'a', 'c'])
    expect(resolved.keymaps).toHaveLength(3)
  })

  it('refuses duplicate names, node types and port types', () => {
    const spec = defineNodeType({ type: 'note', component: { render: () => null } })
    expect(() => resolveFlowExtensions([{ name: 'x' }, { name: 'x' }])).toThrow('added twice')
    expect(() =>
      resolveFlowExtensions([
        { name: 'x', nodeTypes: [spec] },
        { name: 'y', nodeTypes: [spec] },
      ]),
    ).toThrow('node type "note"')
    expect(() =>
      resolveFlowExtensions([
        { name: 'x', portTypes: { text: {} } },
        { name: 'y', portTypes: { text: {} } },
      ]),
    ).toThrow('port type "text"')
  })

  it('renders node types from extensions, and the default node from flowKit', () => {
    const note = defineFlowExtension({
      name: 'notes',
      nodeTypes: [
        defineNodeType({
          type: 'note',
          component: {
            props: ['data'],
            render: (p: any) => h('p', { class: 'note' }, p.data.text),
          },
        }),
      ],
    })
    const { wrapper, doc } = setup([flowKit(), note])
    doc.value = {
      ...doc.value,
      nodes: [...doc.value.nodes, { id: 'n', type: 'note', x: 0, y: 0, data: { text: '记得' } }],
    }
    return nextTick().then(() => {
      expect(wrapper.find('.note').text()).toBe('记得')
      expect(wrapper.find('[data-node-id="a"]').text()).toContain('收集素材')
      wrapper.unmount()
    })
  })

  it('asks extension keys first; returning false passes the key on', async () => {
    const seen: string[] = []
    const keys = defineFlowExtension({
      name: 'keys',
      keymap: (ctx) => ({
        'mod+a': () => {
          seen.push(`mod+a:${ctx.doc.value.nodes.length}`)
          return false
        },
        'shift+n': () => {
          seen.push('shift+n')
        },
      }),
    })
    const { wrapper, root, selection } = setup([flowKit(), keys])
    await root.trigger('keydown', { key: 'N', shiftKey: true })
    await root.trigger('keydown', { key: 'a', ctrlKey: true })
    expect(seen).toEqual(['shift+n', 'mod+a:3'])
    // Passed on: the editor still selected everything.
    expect(selection.value.nodes).toEqual(['a', 'b', 'c'])
    wrapper.unmount()
  })

  it('asks every extension rule before connecting', async () => {
    const asked: string[] = []
    const rule = (name: string, answer: boolean | string) =>
      defineFlowExtension({
        name,
        canConnect: () => {
          asked.push(name)
          return answer
        },
      })
    const { wrapper, root, doc } = setup([flowKit(), rule('first', true), rule('second', '不行')], {
      nodes: ['a'],
      edges: [],
    })
    doc.value = { ...doc.value, edges: [] }
    await nextTick()
    await root.trigger('keydown', { key: 'c' })
    await root.trigger('keydown', { key: 'Enter' })
    expect(asked.slice(0, 2)).toEqual(['first', 'second'])
    expect(doc.value.edges).toEqual([])
    wrapper.unmount()
  })

  it('rewrites pasted nodes', async () => {
    const reset = defineFlowExtension({
      name: 'reset',
      transformPaste: (data) => ({
        ...data,
        nodes: data.nodes.map((n) => ({
          ...n,
          data: { ...n.data, label: `${n.data?.label}副本` },
        })),
      }),
    })
    const { wrapper, root, doc } = setup([flowKit(), reset], { nodes: ['a'], edges: [] })
    ;(root.element as HTMLElement).focus()
    const clipboard = new DataTransfer()
    document.dispatchEvent(new ClipboardEvent('copy', { clipboardData: clipboard }))
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard }))
    await nextTick()
    expect(doc.value.nodes.at(-1)?.data?.label).toBe('收集素材副本')
    wrapper.unmount()
  })

  it('renders layers and overlays that can use the editor', () => {
    const Count = defineComponent(() => {
      const { doc } = useFlowEditor()
      return () => h('span', { class: 'count' }, String(doc.value.nodes.length))
    })
    const { wrapper } = setup([
      flowKit(),
      { name: 'ui', layers: { below: [Count], above: [Count] }, overlays: [Count] },
    ])
    const counts = wrapper.findAll('.count')
    expect(counts.map((c) => c.text())).toEqual(['3', '3', '3'])
    // Layers live in canvas space, overlays over the editor.
    expect(counts[0]!.element.closest('.dou-flow-editor__layer')).not.toBeNull()
    expect(counts[2]!.element.closest('.dou-flow-editor__panels')).not.toBeNull()
    wrapper.unmount()
  })
})

describe('tidy', () => {
  it('lines up connected nodes from the top left, leaves locked ones, as one undo step', async () => {
    const { wrapper, editor, doc } = setup()
    ;(editor.vm as any).tidy()
    await nextTick()
    const [a, b, c] = doc.value.nodes
    expect(a).toMatchObject({ x: 0, y: 0 })
    expect(b!.y).toBe(a!.y)
    expect(b!.x).toBeGreaterThan(a!.x)
    expect(c).toMatchObject({ x: 40, y: 400 })
    ;(editor.vm as any).undo()
    expect(doc.value).toEqual(sample())
    wrapper.unmount()
  })

  it('only tidies the selection when two or more nodes are selected', async () => {
    const { wrapper, editor, doc } = setup(undefined, { nodes: ['a', 'b'], edges: [] })
    doc.value = {
      ...doc.value,
      nodes: [...doc.value.nodes, { id: 'd', x: 600, y: 600, data: { label: '归档' } }],
    }
    await nextTick()
    ;(editor.vm as any).tidy()
    expect(doc.value.nodes.find((n) => n.id === 'd')).toMatchObject({ x: 600, y: 600 })
    expect(doc.value.nodes[1]!.y).toBe(0)
    wrapper.unmount()
  })
})

describe('DouFlowMinimap', () => {
  it('draws every node and moves the view where it is pressed', async () => {
    const { wrapper } = setup(undefined, { nodes: ['b'], edges: [] })
    await nextTick()
    const map = wrapper.find('.dou-flow-minimap')
    expect(map.attributes('role')).toBe('img')
    const rects = map.findAll('.dou-flow-minimap__node')
    expect(rects).toHaveLength(3)
    expect(rects[1]!.classes()).toContain('is-selected')
    const editor = wrapper.findComponent(DouFlowEditor)
    const before = { ...(editor.vm as any).viewport }
    await map.find('svg').trigger('pointerdown', { button: 0, clientX: 150, clientY: 100 })
    await map.find('svg').trigger('pointerup')
    const viewport = editor.emitted('update:viewport')?.at(-1)?.[0]
    expect(viewport).toBeDefined()
    expect(viewport).not.toEqual(before)
    wrapper.unmount()
  })
})
