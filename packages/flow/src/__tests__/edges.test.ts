import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { bezierEdge, defineEdgeType, DouFlowEditor, stepEdge, straightEdge } from '../index'
import { resolveFlowExtensions } from '../core/extension'
import type {
  EdgeAnchor,
  FlowDocument,
  FlowEditorExpose,
  FlowSelection,
  FlowViewport,
} from '../index'

const at = (x: number, y: number, side: EdgeAnchor['side']): EdgeAnchor => ({ x, y, side })

describe('edge types', () => {
  it('bezier: labels the middle of the curve', () => {
    const route = bezierEdge.route(at(0, 0, 'right'), at(200, 100, 'left'))
    expect(route.path.startsWith('M0 0C')).toBe(true)
    expect(route.label).toEqual({ x: 100, y: 50 })
  })

  it('straight: one line, labelled in the middle', () => {
    const route = straightEdge.route(at(0, 0, 'right'), at(100, 40, 'left'))
    expect(route.path).toBe('M0 0L100 40')
    expect(route.label).toEqual({ x: 50, y: 20 })
  })

  it('step: rounded corners, and a middle segment kept in edge.data.bend', () => {
    const edge = { id: 'e', source: { node: 'a' }, target: { node: 'b' } }
    const route = stepEdge.route(at(0, 0, 'right'), at(200, 100, 'left'), edge)
    expect(route.path).toContain('Q')
    expect(route.label).toEqual({ x: 100, y: 50 })
    expect(route.handle).toMatchObject({ at: { x: 100, y: 50 }, axis: 'x' })
    expect(route.handle!.move({ x: 150, y: 0 })).toEqual({ bend: 0.75 })
    const bent = stepEdge.route(at(0, 0, 'right'), at(200, 100, 'left'), {
      ...edge,
      data: { bend: 0.25 },
    })
    expect(bent.label.x).toBe(50)
  })

  it('step: turns with vertical ports', () => {
    const route = stepEdge.route(at(0, 0, 'bottom'), at(100, 200, 'top'))
    expect(route.handle).toMatchObject({ at: { x: 50, y: 100 }, axis: 'y' })
    expect(route.handle!.move({ x: 0, y: 50 })).toEqual({ bend: 0.25 })
  })

  it('step: goes around when the target is behind, without a handle', () => {
    const route = stepEdge.route(at(200, 0, 'right'), at(0, 100, 'left'))
    expect(route.handle).toBeUndefined()
    // Out past the source and in from before the target.
    expect(route.path).toContain('220 ')
    expect(route.path).toContain('-20 ')
  })

  it('refuses an edge type defined twice', () => {
    const line = defineEdgeType({ type: 'line', route: straightEdge.route })
    expect(() =>
      resolveFlowExtensions([
        { name: 'a', edgeTypes: [line] },
        { name: 'b', edgeTypes: [line] },
      ]),
    ).toThrow('edge type "line"')
  })
})

// jsdom lays nothing out: give every element a size so nodes get measured.
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

const sample = (): FlowDocument => ({
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: '读取笔记', outputs: [{ id: 'out' }] } },
    { id: 'b', x: 400, y: 200, data: { label: '发布', inputs: [{ id: 'in' }] } },
    // Far out of view.
    { id: 'far', x: 6000, y: 4000, data: { label: '归档', inputs: [{ id: 'in' }] } },
    { id: 'farther', x: 6400, y: 4000, data: { label: '汇总', inputs: [{ id: 'in' }] } },
  ],
  edges: [
    {
      id: 'e',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: '摘要',
    },
    { id: 'gone', source: { node: 'far' }, target: { node: 'farther', port: 'in' } },
  ],
})

async function setup(props: Record<string, unknown> = {}) {
  const doc = ref(sample())
  const selection = ref<FlowSelection>({ nodes: [], edges: [] })
  const viewport = ref<FlowViewport>({ x: 0, y: 0, zoom: 1 })
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          modelValue: doc.value,
          'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
          viewport: viewport.value,
          'onUpdate:viewport': (value: FlowViewport) => (viewport.value = value),
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  // Mount, measure, then draw what is in view.
  for (let i = 0; i < 4; i++) await nextTick()
  const root = wrapper.find('.dou-flow-editor')
  const editor = wrapper.findComponent(DouFlowEditor).vm as unknown as FlowEditorExpose
  return { wrapper, root, editor, doc, selection, viewport }
}

const ticks = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}

const pointer = (type: string, x: number) =>
  new PointerEvent(type, { bubbles: true, clientX: x, clientY: 100, button: 0, pointerId: 3 })

describe('edges in the editor', () => {
  it('draws edges with the edge-type prop, unless they name a type', async () => {
    const { root, doc } = await setup({ edgeType: 'straight' })
    expect(root.find('[data-edge-id="e"] .dou-flow-editor__edge').attributes('d')).toMatch(
      /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/,
    )
    doc.value = { ...doc.value, edges: [{ ...doc.value.edges[0]!, type: 'step' }] }
    await ticks()
    expect(root.find('[data-edge-id="e"] .dou-flow-editor__edge').attributes('d')).toContain('Q')
  })

  it('draws edge types from extensions and props', async () => {
    const zigzag = defineEdgeType({
      type: 'zigzag',
      route: (s) => ({ path: `M${s.x} ${s.y}Z`, label: s }),
    })
    const { root, doc } = await setup({ edgeTypes: [zigzag] })
    doc.value = { ...doc.value, edges: [{ ...doc.value.edges[0]!, type: 'zigzag' }] }
    await ticks()
    expect(root.find('[data-edge-id="e"] .dou-flow-editor__edge').attributes('d')).toMatch(/Z$/)
  })

  it('marks animated edges', async () => {
    const { root, doc } = await setup()
    doc.value = { ...doc.value, edges: [{ ...doc.value.edges[0]!, animated: true }] }
    await ticks()
    expect(root.find('[data-edge-id="e"] .dou-flow-editor__edge').classes()).toContain(
      'is-animated',
    )
  })

  it('edits a label on double click: Enter keeps it as one undo step', async () => {
    const { root, doc, editor, selection } = await setup()
    await root.find('.dou-flow-editor__label').trigger('dblclick')
    await ticks()
    expect(selection.value).toEqual({ nodes: [], edges: ['e'] })
    const input = root.find<HTMLInputElement>('.dou-flow-editor__label-input')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('  摘要和标签 ')
    await input.trigger('keydown', { key: 'Enter' })
    await ticks()
    expect(doc.value.edges[0]!.label).toBe('摘要和标签')
    expect(root.find('.dou-flow-editor__label-input').exists()).toBe(false)
    editor.undo()
    await ticks()
    expect(doc.value.edges[0]!.label).toBe('摘要')
  })

  it('Escape leaves the label as it was; an empty one removes it', async () => {
    const { root, doc } = await setup()
    await root.find('.dou-flow-editor__label').trigger('dblclick')
    await ticks()
    let input = root.find<HTMLInputElement>('.dou-flow-editor__label-input')
    await input.setValue('别的')
    await input.trigger('keydown', { key: 'Escape' })
    await ticks()
    expect(doc.value.edges[0]!.label).toBe('摘要')
    await root.find('.dou-flow-editor__label').trigger('dblclick')
    await ticks()
    input = root.find<HTMLInputElement>('.dou-flow-editor__label-input')
    await input.setValue('')
    await input.trigger('blur')
    await ticks()
    expect(doc.value.edges[0]!.label).toBeUndefined()
  })

  it('opens the label with Enter on a selected edge, not while read only', async () => {
    const { root, selection } = await setup()
    selection.value = { nodes: [], edges: ['e'] }
    await ticks()
    await root.trigger('keydown', { key: 'Enter' })
    await ticks()
    expect(root.find('.dou-flow-editor__label-input').exists()).toBe(true)

    const other = await setup({ readonly: true })
    other.selection.value = { nodes: [], edges: ['e'] }
    await ticks()
    await other.root.find('.dou-flow-editor__label').trigger('dblclick')
    await other.root.trigger('keydown', { key: 'Enter' })
    await ticks()
    expect(other.root.find('.dou-flow-editor__label-input').exists()).toBe(false)
  })

  it('drags the middle of a selected step edge, and Escape puts it back', async () => {
    const { root, doc, selection } = await setup({ edgeType: 'step' })
    // Without a label the handle shows on its own.
    doc.value = { ...doc.value, edges: [{ ...doc.value.edges[0]!, label: undefined }] }
    selection.value = { nodes: [], edges: ['e'] }
    await ticks()
    const handle = root.find('.dou-flow-editor__bend')
    expect(handle.exists()).toBe(true)
    handle.element.dispatchEvent(pointer('pointerdown', 100))
    root.element.dispatchEvent(pointer('pointermove', 140))
    await ticks()
    const bend = doc.value.edges[0]!.data?.bend as number
    expect(bend).not.toBe(0.5)
    expect(bend).toBeGreaterThan(0)
    await root.trigger('keydown', { key: 'Escape' })
    await ticks()
    expect(doc.value.edges[0]!.data?.bend).toBeUndefined()
  })
})

describe('large flows', () => {
  it('leaves out nodes and edges far out of view, once measured', async () => {
    const { root } = await setup()
    const ids = root.findAll('[data-node-id]').map((n) => n.attributes('data-node-id'))
    expect(ids).toEqual(['a', 'b'])
    expect(root.find('[data-edge-id="gone"]').exists()).toBe(false)
  })

  it('keeps selected nodes drawn, and draws a node focused from the keyboard', async () => {
    const { root, selection, viewport } = await setup()
    selection.value = { nodes: ['far'], edges: [] }
    await ticks()
    expect(root.find('[data-node-id="far"]').exists()).toBe(true)
    selection.value = { nodes: [], edges: [] }
    viewport.value = { x: 0, y: 0, zoom: 1 }
    await ticks()
    expect(root.find('[data-node-id="far"]').exists()).toBe(false)
    // Tab from the last node in view reaches it.
    ;(root.element as HTMLElement).focus()
    const seen: (string | null | undefined)[] = []
    for (let i = 0; i < 3; i++) {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      )
      await ticks()
      seen.push(document.activeElement?.getAttribute('data-node-id'))
    }
    expect(seen).toContain('far')
  })

  it('draws plain boxes with names when zoomed out, and hides edge labels', async () => {
    const { root, viewport } = await setup({ simpleZoom: 0.5 })
    viewport.value = { x: 0, y: 0, zoom: 0.3 }
    await ticks()
    const simple = root.findAll('.dou-flow-editor__simple')
    expect(simple.map((n) => n.text())).toEqual(['读取笔记', '发布'])
    expect(root.find('.dou-flow-editor__node').exists()).toBe(false)
    expect(root.find('.dou-flow-editor__label').exists()).toBe(false)
    expect(root.find('[data-edge-id="e"]').exists()).toBe(true)
  })

  it('takes a simple slot', async () => {
    const doc = ref(sample())
    const wrapper = mount(DouFlowEditor, {
      props: {
        modelValue: doc.value,
        viewport: { x: 0, y: 0, zoom: 0.2 },
      },
      slots: { simple: ({ node }: any) => h('b', node.id) },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    for (let i = 0; i < 4; i++) await nextTick()
    expect(wrapper.findAll('.dou-flow-editor__simple b').map((n) => n.text())).toEqual(['a', 'b'])
  })
})
