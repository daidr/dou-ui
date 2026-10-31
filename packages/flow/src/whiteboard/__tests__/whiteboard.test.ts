import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { connectorEdge, whiteboardKit, type WhiteboardTool } from '..'
import { DouFlowEditor, flowKit } from '../../index'
import type { FlowDocument, FlowSelection, FlowViewport } from '../../index'

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
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

const ticks = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

const pointer = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 3,
    ...init,
  })

function setup(doc: FlowDocument = { nodes: [], edges: [] }) {
  const flow = ref(doc)
  const selection = ref<FlowSelection>({ nodes: [], edges: [] })
  const viewport = ref<FlowViewport>({ x: 0, y: 0, zoom: 1 })
  const tool = ref<WhiteboardTool>('select')
  const extensions = [flowKit(), whiteboardKit({ tool })]
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          modelValue: flow.value,
          'onUpdate:modelValue': (value: FlowDocument) => (flow.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
          viewport: viewport.value,
          'onUpdate:viewport': (value: FlowViewport) => (viewport.value = value),
          extensions,
          edgeType: 'connector',
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  const root = wrapper.find('.dou-flow-editor')
  const key = (name: string) =>
    root.element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  /** Presses at `from`, moves through `path` and lets go at its last point. */
  const drag = async (from: [number, number], ...path: [number, number][]) => {
    root.element.dispatchEvent(pointer('pointerdown', ...from))
    for (const at of path) root.element.dispatchEvent(pointer('pointermove', ...at))
    const end = path[path.length - 1] ?? from
    root.element.dispatchEvent(pointer('pointerup', ...end))
    await ticks()
  }
  return { wrapper, root, flow, selection, viewport, tool, key, drag }
}

describe('whiteboard tools', () => {
  it('draws a shape the size of the dragged box, then goes back to select', async () => {
    const { flow, tool, drag, selection, root } = setup()
    await ticks()
    tool.value = 'ellipse'
    await ticks()
    expect(root.attributes('data-board-tool')).toBe('ellipse')
    await drag([100, 100], [200, 150], [260, 220])
    expect(flow.value.nodes).toHaveLength(1)
    expect(flow.value.nodes[0]).toMatchObject({
      type: 'shape',
      x: 100,
      y: 100,
      width: 160,
      height: 120,
      data: { shape: 'ellipse' },
    })
    expect(selection.value.nodes).toEqual([flow.value.nodes[0]!.id])
    expect(tool.value).toBe('select')
  })

  it('shows the box while drawing, and Escape draws nothing', async () => {
    const { flow, tool, root, key } = setup()
    await ticks()
    tool.value = 'rect'
    await ticks()
    root.element.dispatchEvent(pointer('pointerdown', 50, 50))
    root.element.dispatchEvent(pointer('pointermove', 150, 120))
    await ticks()
    const draft = root.find('.dou-whiteboard-draft')
    expect(draft.attributes('style')).toContain('width: 100px')
    key('Escape')
    root.element.dispatchEvent(pointer('pointerup', 150, 120))
    await ticks()
    expect(root.find('.dou-whiteboard-draft').exists()).toBe(false)
    expect(flow.value.nodes).toHaveLength(0)
  })

  it('puts a note down at its default size on a click, ready to write in', async () => {
    const { flow, tool, drag, root } = setup()
    await ticks()
    tool.value = 'sticky'
    await ticks()
    await drag([300, 300])
    expect(flow.value.nodes[0]).toMatchObject({ type: 'sticky', x: 220, y: 220, width: 160 })
    const field = root.find<HTMLTextAreaElement>('textarea')
    expect(field.exists()).toBe(true)
    await field.setValue('顺路吃生煎\n')
    await field.trigger('keydown', { key: 'Escape' })
    await ticks()
    // trailing space is dropped
    expect(flow.value.nodes[0]!.data).toEqual({ text: '顺路吃生煎' })
    expect(root.find('textarea').exists()).toBe(false)
  })

  it('picks tools with their keys, and Escape goes back to select', async () => {
    const { tool, key } = setup()
    await ticks()
    key('r')
    await ticks()
    expect(tool.value).toBe('rect')
    key('s')
    await ticks()
    expect(tool.value).toBe('sticky')
    key('Escape')
    await ticks()
    expect(tool.value).toBe('select')
  })

  it('moves the view with the hand', async () => {
    const { tool, viewport, drag, flow } = setup()
    await ticks()
    tool.value = 'hand'
    await ticks()
    await drag([100, 100], [160, 140])
    expect(viewport.value).toMatchObject({ x: 60, y: 40 })
    expect(flow.value.nodes).toHaveLength(0)
  })

  it('writes in the selected shape with Enter or a double click', async () => {
    const { root, flow, selection, key } = setup({
      nodes: [
        { id: 'a', type: 'shape', x: 0, y: 0, width: 160, height: 100, data: { shape: 'diamond' } },
      ],
      edges: [],
    })
    await ticks()
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    key('Enter')
    await ticks()
    const field = root.find<HTMLTextAreaElement>('textarea')
    await field.setValue('周六有空？')
    await field.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await ticks()
    expect(flow.value.nodes[0]!.data).toEqual({ shape: 'diamond', text: '周六有空？' })
    await root.find('.dou-whiteboard-node').trigger('dblclick')
    await ticks()
    expect(root.find<HTMLTextAreaElement>('textarea').element.value).toBe('周六有空？')
  })

  it('keeps a tool picked with a double click', async () => {
    const { root, tool, drag, flow } = setup()
    await ticks()
    const button = root.findAll('.dou-whiteboard-toolbar__button')[2]!
    await button.trigger('click')
    await button.trigger('dblclick')
    expect(tool.value).toBe('rect')
    await drag([0, 0])
    await drag([400, 0])
    expect(flow.value.nodes).toHaveLength(2)
    expect(tool.value).toBe('rect')
  })
})

describe('connector', () => {
  it('runs straight from anchor to anchor and ends in an arrow', () => {
    const route = connectorEdge.route({ x: 0, y: 0, side: 'right' }, { x: 100, y: 0, side: 'left' })
    expect(route.path.startsWith('M0 0L100 0M')).toBe(true)
    // the arrow's two wings meet at the end
    expect(route.path).toMatch(/M[\d.]+ -?[\d.]+L100 0L[\d.]+ -?[\d.]+$/)
    expect(route.label).toEqual({ x: 50, y: 0 })
  })

  it('joins any two anchors, in either direction', async () => {
    const { root, flow } = setup({
      nodes: [
        { id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 100, data: { shape: 'rect' } },
        { id: 'b', type: 'sticky', x: 300, y: 0, width: 100, height: 100, data: {} },
      ],
      edges: [],
    })
    await ticks()
    const port = root.find('[data-node-id="b"] .dou-flow-port.is-output.is-left')
    document.elementFromPoint = () => root.find('[data-node-id="a"]').element
    port.element.dispatchEvent(pointer('pointerdown', 300, 50))
    root.element.dispatchEvent(pointer('pointermove', 200, 50))
    root.element.dispatchEvent(pointer('pointermove', 60, 50))
    root.element.dispatchEvent(pointer('pointerup', 60, 50))
    await ticks()
    expect(flow.value.edges).toHaveLength(1)
    expect(flow.value.edges[0]).toMatchObject({
      source: { node: 'b', port: 'left' },
      target: { node: 'a' },
    })
  })
})
