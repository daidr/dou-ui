import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { connectorEdge, whiteboardKit, type WhiteboardTool } from '..'
import { inkHit, inkOutline, strokeNode, turn } from '../ink'
import { resizeTurned, snapAngle } from '../transform'
import { defineFlowExtension, defineNodeType, DouFlowEditor, flowKit } from '../../index'
import type { FlowDocument, FlowExtension, FlowSelection, FlowViewport } from '../../index'

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

function setup(doc: FlowDocument = { nodes: [], edges: [] }, extra: FlowExtension[] = []) {
  const flow = ref(doc)
  const selection = ref<FlowSelection>({ nodes: [], edges: [] })
  const viewport = ref<FlowViewport>({ x: 0, y: 0, zoom: 1 })
  const tool = ref<WhiteboardTool>('select')
  const extensions = [flowKit(), whiteboardKit({ tool }), ...extra]
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
    const { root, tool, viewport, flow } = setup()
    await ticks()
    tool.value = 'hand'
    await ticks()
    const button = () => root.findAll('.dou-whiteboard-toolbar__button')[1]!
    const handOpen = button().html()
    root.element.dispatchEvent(pointer('pointerdown', 100, 100))
    root.element.dispatchEvent(pointer('pointermove', 130, 120))
    await ticks()
    // the hand closes while it holds the view
    expect(root.attributes('data-board-panning')).toBeDefined()
    expect(button().html()).not.toBe(handOpen)
    root.element.dispatchEvent(pointer('pointermove', 160, 140))
    root.element.dispatchEvent(pointer('pointerup', 160, 140))
    await ticks()
    expect(root.attributes('data-board-panning')).toBeUndefined()
    expect(button().html()).toBe(handOpen)
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

describe('keyboard and names', () => {
  it('puts a shape down with Enter while a drawing tool is picked', async () => {
    const { root, key, flow, selection, tool } = setup()
    await ticks()
    key('o')
    await ticks()
    key('Enter')
    await ticks()
    expect(flow.value.nodes).toHaveLength(1)
    expect(flow.value.nodes[0]).toMatchObject({
      type: 'shape',
      width: 140,
      height: 100,
      data: { shape: 'ellipse' },
    })
    expect(selection.value.nodes).toEqual([flow.value.nodes[0]!.id])
    expect(tool.value).toBe('select')
    expect(root.find('[aria-live]').text()).toBe('已添加椭圆')
  })

  it('puts the next one after the selected node, joined to it', async () => {
    const { key, flow } = setup({
      nodes: [
        { id: 'a', type: 'shape', x: 0, y: 0, width: 160, height: 100, data: { shape: 'rect' } },
      ],
      edges: [],
    })
    await ticks()
    key('Tab')
    await ticks()
    key('r')
    await ticks()
    key('Enter')
    await ticks()
    expect(flow.value.nodes).toHaveLength(2)
    expect(flow.value.nodes[1]!.x).toBeGreaterThan(160)
    expect(flow.value.edges[0]).toMatchObject({
      source: { node: 'a', port: 'right' },
      target: { node: flow.value.nodes[1]!.id, port: 'left-in' },
    })
  })

  it('opens a note put down with Enter for writing', async () => {
    const { root, key } = setup()
    await ticks()
    key('s')
    await ticks()
    key('Enter')
    await ticks()
    expect(root.find('textarea').exists()).toBe(true)
  })

  it('names nodes in the editor language', async () => {
    const { root, drag, tool } = setup({
      nodes: [
        { id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 100, data: { shape: 'diamond' } },
        { id: 'b', type: 'sticky', x: 300, y: 0, width: 100, height: 100, data: { text: '买票' } },
      ],
      edges: [],
    })
    await ticks()
    expect(root.find('[data-node-id="a"]').attributes('aria-label')).toContain('菱形')
    expect(root.find('[data-node-id="b"]').attributes('aria-label')).toContain('便签：买票')
    tool.value = 'rect'
    await ticks()
    await drag([600, 300], [700, 380])
    expect(root.find('[aria-live]').text()).toBe('已添加矩形')
  })

  it('gives focus back to the canvas after a toolbar button is used', async () => {
    const { root, key, tool } = setup()
    await ticks()
    const button = root.findAll('.dou-whiteboard-toolbar__button')[2]!
    ;(button.element as HTMLElement).focus()
    await button.trigger('click')
    expect(document.activeElement).toBe(root.element)
    key('Escape')
    await ticks()
    expect(tool.value).toBe('select')
  })

  it('draws connectors without an edge-type prop', async () => {
    const { root } = setup({
      nodes: [
        { id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 100, data: { shape: 'rect' } },
        { id: 'b', type: 'text', x: 300, y: 0, width: 100, data: { text: '注' } },
      ],
      edges: [
        { id: 'e', source: { node: 'a', port: 'right' }, target: { node: 'b', port: 'left-in' } },
      ],
    })
    await ticks()
    expect(root.find('[data-edge-type]').attributes('data-edge-type')).toBe('connector')
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

  it('says so when a connector is let go over a node it can not join', async () => {
    const plain = defineFlowExtension({
      name: 'plain',
      nodeTypes: [defineNodeType({ type: 'plain' })],
    })
    const { root, flow } = setup(
      {
        nodes: [
          { id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 100, data: { shape: 'rect' } },
          { id: 'b', type: 'plain', x: 300, y: 0, width: 100, height: 100, data: {} },
        ],
        edges: [],
      },
      [plain],
    )
    await ticks()
    const port = root.find('[data-node-id="a"] .dou-flow-port.is-output.is-right')
    document.elementFromPoint = () => root.find('[data-node-id="b"]').element
    port.element.dispatchEvent(pointer('pointerdown', 100, 50))
    root.element.dispatchEvent(pointer('pointermove', 200, 50))
    root.element.dispatchEvent(pointer('pointermove', 350, 50))
    root.element.dispatchEvent(pointer('pointerup', 350, 50))
    await ticks()
    expect(flow.value.edges).toHaveLength(0)
    expect(root.find('[aria-live]').text()).toBe('没有可以连接的端口')
  })
})

const stroke = (id: string, y: number) =>
  strokeNode(id, [
    { x: 0, y, pressure: 0.5 },
    { x: 100, y, pressure: 0.5 },
  ])

const card = (id: string, x: number, z?: number) => ({
  id,
  type: 'sticky',
  x,
  y: 0,
  width: 100,
  height: 100,
  data: {},
  ...(z === undefined ? {} : { z }),
})

const order = (root: {
  findAll: (s: string) => { attributes: (n: string) => string | undefined }[]
}) => root.findAll('.dou-flow-editor__node').map((n) => n.attributes('data-node-id'))

describe('pen and eraser', () => {
  it('draws a stroke that becomes an ink node, and keeps the pen', async () => {
    const { root, tool, drag, flow } = setup()
    await ticks()
    tool.value = 'pen'
    await ticks()
    root.element.dispatchEvent(pointer('pointerdown', 100, 100))
    root.element.dispatchEvent(pointer('pointermove', 140, 120))
    await ticks()
    // the stroke shows while it is drawn
    expect(root.find('.dou-whiteboard-strokes__ink').attributes('d')).toMatch(/^M/)
    root.element.dispatchEvent(pointer('pointermove', 180, 100))
    root.element.dispatchEvent(pointer('pointerup', 180, 100))
    await ticks()
    expect(root.find('.dou-whiteboard-strokes').exists()).toBe(false)
    expect(flow.value.nodes).toHaveLength(1)
    const node = flow.value.nodes[0]!
    expect(node.type).toBe('ink')
    const data = node.data as { points: number[]; box: [number, number] }
    expect(data.points.length % 3).toBe(0)
    expect(data.box).toEqual([node.width, node.height])
    // the box holds the stroke with room for its width
    expect(node.x).toBeLessThan(100)
    expect(node.x + node.width!).toBeGreaterThan(160)
    expect(tool.value).toBe('pen')
    expect(root.find('[aria-live]').text()).toBe('已添加笔迹')
    await drag([300, 300], [340, 340])
    expect(flow.value.nodes).toHaveLength(2)
  })

  it('erases the strokes it passes over once it lets go, and Escape keeps them', async () => {
    const { root, tool, drag, flow } = setup({
      nodes: [stroke('a', 50), stroke('b', 200)],
      edges: [],
    })
    await ticks()
    tool.value = 'eraser'
    await ticks()
    root.element.dispatchEvent(pointer('pointerdown', 50, 0))
    root.element.dispatchEvent(pointer('pointermove', 50, 100))
    await ticks()
    expect(root.find('[data-node-id="a"] .dou-whiteboard-node').classes()).toContain('is-erasing')
    root.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await ticks()
    expect(flow.value.nodes).toHaveLength(2)
    // a quick swipe straight across both
    await drag([50, 0], [50, 260])
    expect(flow.value.nodes).toHaveLength(0)
    expect(root.find('[aria-live]').text()).toBe('已擦除 2 条笔迹')
  })
})

describe('ink geometry', () => {
  it('outlines a stroke with round ends, and a dot as a circle', () => {
    const line = [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 10, y: 0, pressure: 0.5 },
      { x: 20, y: 0, pressure: 0.5 },
    ]
    const d = inkOutline(line, 4)
    // along one side, round the end, back along the other, round the start
    expect(d).toMatch(/^M0 2Q10 2 15 1\.?\d*|^M0 2/)
    expect(d.match(/A2 2 0 0 0/g)).toHaveLength(2)
    expect(inkOutline([{ x: 5, y: 5, pressure: 0.5 }], 4)).toBe(
      'M3 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0Z',
    )
  })

  it('hits a stroke near its line, also once it is stretched and turned', () => {
    const node = strokeNode('s', [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 100, y: 0, pressure: 0.5 },
    ])
    const y = node.y + node.height! / 2
    expect(inkHit(node, { x: node.x + 50, y: y + 4 }, 2)).toBe(true)
    expect(inkHit(node, { x: node.x + 50, y: y + 20 }, 2)).toBe(false)
    const turned = { ...node, data: { ...node.data, rotation: 90 } }
    const centre = { x: node.x + node.width! / 2, y }
    expect(inkHit(turned, { x: centre.x, y: centre.y + 40 }, 2)).toBe(true)
    expect(inkHit(turned, { x: centre.x + 40, y: centre.y }, 2)).toBe(false)
  })
})

describe('turning', () => {
  it('snaps to 15° with Shift, and to a right angle when close', () => {
    expect(snapAngle(52, true)).toBe(45)
    expect(snapAngle(88, false)).toBe(90)
    expect(snapAngle(-30, false)).toBe(330)
    expect(snapAngle(37, false)).toBe(37)
  })

  it('grows a turned node along its own sides, keeping the far corner', () => {
    const start = { x: 0, y: 0, width: 100, height: 50 }
    const next = resizeTurned(start, 90, { x: 0, y: 20 }, { width: 10, height: 10 })
    // turned a quarter, dragging down widens it
    expect(next.width).toBeCloseTo(120)
    expect(next.height).toBeCloseTo(50)
    const corner = (r: typeof start) =>
      turn({ x: r.x, y: r.y }, { x: r.x + r.width / 2, y: r.y + r.height / 2 }, 90)
    expect(corner(next).x).toBeCloseTo(corner(start).x)
    expect(corner(next).y).toBeCloseTo(corner(start).y)
  })

  it('turns with the handle in one undo step; a turned node has its own corner handle', async () => {
    const { root, flow, selection } = setup({
      nodes: [
        { id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 100, data: { shape: 'rect' } },
      ],
      edges: [],
    })
    await ticks()
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    expect(root.find('.dou-flow-editor__resize').exists()).toBe(true)
    const handle = root.find('.dou-whiteboard-node__turn')
    // the handle starts below the centre (50, 50); go round to its left
    handle.element.dispatchEvent(pointer('pointerdown', 50, 124))
    handle.element.dispatchEvent(pointer('pointermove', 0, 50))
    await ticks()
    expect(root.find('.dou-whiteboard-node').attributes('style')).toContain('rotate: 90deg')
    expect(flow.value.nodes[0]!.data).not.toHaveProperty('rotation')
    handle.element.dispatchEvent(pointer('pointerup', 0, 50))
    await ticks()
    expect(flow.value.nodes[0]!.data).toMatchObject({ rotation: 90 })
    expect(root.find('[aria-live]').text()).toBe('已旋转到 90°')
    expect(root.find('.dou-flow-editor__resize').exists()).toBe(false)
    expect(root.find('.dou-whiteboard-node__corner').exists()).toBe(true)
  })

  it('lets Escape put a turn back', async () => {
    const { root, flow, selection } = setup({
      nodes: [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 100, height: 100, data: {} }],
      edges: [],
    })
    await ticks()
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    const handle = root.find('.dou-whiteboard-node__turn')
    handle.element.dispatchEvent(pointer('pointerdown', 50, 124))
    handle.element.dispatchEvent(pointer('pointermove', 0, 50))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    handle.element.dispatchEvent(pointer('pointerup', 0, 50))
    await ticks()
    expect(flow.value.nodes[0]!.data).not.toHaveProperty('rotation')
    expect(root.find('.dou-whiteboard-node').attributes('style') ?? '').not.toContain('rotate')
  })
})

describe('layers', () => {
  it('draws nodes by z, then in document order', async () => {
    const { root } = setup({
      nodes: [card('a', 0, 2), card('b', 50), card('c', 300, -1)],
      edges: [],
    })
    await ticks()
    expect(order(root)).toEqual(['c', 'b', 'a'])
  })

  it('moves the selection one step past what it overlaps, or to the top or bottom', async () => {
    const { root, selection } = setup({
      // a and b overlap; c is far off
      nodes: [card('a', 0), card('b', 50), card('c', 400)],
      edges: [],
    })
    await ticks()
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    const press = (k: string, shift = false) =>
      root.element.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, ctrlKey: true, shiftKey: shift, bubbles: true }),
      )
    press(']')
    await ticks()
    // past b only: c doesn't overlap, so a stays under it
    expect(order(root)).toEqual(['b', 'a', 'c'])
    expect(root.find('[aria-live]').text()).toBe('上移一层')
    press('[', true)
    await ticks()
    expect(order(root)).toEqual(['a', 'b', 'c'])
    press('[', true)
    await ticks()
    // already at the bottom: nothing to undo, and it says so
    expect(root.find('[aria-live]').text()).toBe('已经在最底层')
    press('[')
    await ticks()
    expect(root.find('[aria-live]').text()).toBe('已经在最底层')
    press(']', true)
    await ticks()
    expect(order(root)).toEqual(['b', 'c', 'a'])
  })

  it('works in a plain flow too, through flowKit', async () => {
    const flow = ref<FlowDocument>({
      nodes: [
        { id: 'a', x: 0, y: 0, width: 100, height: 60, data: { label: 'a' } },
        { id: 'b', x: 50, y: 20, width: 100, height: 60, data: { label: 'b' } },
        { id: 'c', x: 400, y: 0, width: 100, height: 60, data: { label: 'c' } },
      ],
      edges: [],
    })
    const selection = ref<FlowSelection>({ nodes: ['b'], edges: [] })
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouFlowEditor, {
            modelValue: flow.value,
            'onUpdate:modelValue': (value: FlowDocument) => (flow.value = value),
            selection: selection.value,
            'onUpdate:selection': (value: FlowSelection) => (selection.value = value),
          }),
      ),
      { attachTo: document.body },
    )
    mounted.push(wrapper)
    await ticks()
    const root = wrapper.find('.dou-flow-editor')
    root.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: '[', ctrlKey: true, bubbles: true }),
    )
    await ticks()
    expect(order(root)).toEqual(['b', 'a', 'c'])
    expect(root.find('[aria-live]').text()).toBe('下移一层')
    // c overlaps nothing: a step up has nothing to pass
    selection.value = { nodes: ['c'], edges: [] }
    await ticks()
    root.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: ']', ctrlKey: true, bubbles: true }),
    )
    await ticks()
    expect(root.find('[aria-live]').text()).toBe('已经在最上层')
  })

  it('puts what is added on top, once nodes have a z', async () => {
    const { flow, tool, drag } = setup({ nodes: [card('a', 0, 3)], edges: [] })
    await ticks()
    tool.value = 'rect'
    await ticks()
    await drag([500, 500])
    expect(flow.value.nodes[1]!.z).toBe(4)
  })
})

describe('images', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('adds dropped image files through the upload, at the drop point', async () => {
    // an image that "loads" at 640 × 480
    vi.stubGlobal(
      'Image',
      class extends EventTarget {
        naturalWidth = 640
        naturalHeight = 480
        set src(_: string) {
          queueMicrotask(() => this.dispatchEvent(new Event('load')))
        }
      },
    )
    const uploaded: string[] = []
    const upload = async (file: File) => {
      uploaded.push(file.name)
      return `https://example.com/${encodeURIComponent(file.name)}`
    }
    const flow = ref<FlowDocument>({ nodes: [], edges: [] })
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouFlowEditor, {
            modelValue: flow.value,
            'onUpdate:modelValue': (value: FlowDocument) => (flow.value = value),
            extensions: [flowKit(), whiteboardKit({ upload })],
          }),
      ),
      { attachTo: document.body },
    )
    mounted.push(wrapper)
    await ticks()
    const root = wrapper.find('.dou-flow-editor')
    const files = [
      new File(['x'], '展览海报.png', { type: 'image/png' }),
      new File(['y'], 'notes.txt', { type: 'text/plain' }),
    ]
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperties(drop, {
      dataTransfer: { value: { files, types: ['Files'] } },
      clientX: { value: 300 },
      clientY: { value: 200 },
    })
    root.element.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await ticks()
    expect(uploaded).toEqual(['展览海报.png'])
    expect(flow.value.nodes).toHaveLength(1)
    // at most 320 on its longer side, keeping its shape
    expect(flow.value.nodes[0]).toMatchObject({
      type: 'image',
      width: 320,
      height: 240,
      data: {
        src: 'https://example.com/%E5%B1%95%E8%A7%88%E6%B5%B7%E6%8A%A5.png',
        alt: '展览海报',
      },
    })
    expect(root.find('.dou-whiteboard-node__image').attributes('alt')).toBe('展览海报')
  })

  it('takes the description an upload gives', async () => {
    vi.stubGlobal(
      'Image',
      class extends EventTarget {
        naturalWidth = 100
        naturalHeight = 100
        set src(_: string) {
          queueMicrotask(() => this.dispatchEvent(new Event('load')))
        }
      },
    )
    const flow = ref<FlowDocument>({ nodes: [], edges: [] })
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouFlowEditor, {
            modelValue: flow.value,
            'onUpdate:modelValue': (value: FlowDocument) => (flow.value = value),
            extensions: [
              flowKit(),
              whiteboardKit({ upload: () => ({ src: '/poster.png', alt: '上海展览海报' }) }),
            ],
          }),
      ),
      { attachTo: document.body },
    )
    mounted.push(wrapper)
    await ticks()
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [new File(['x'], 'IMG_0412.png', { type: 'image/png' })], types: ['Files'] },
    })
    wrapper.find('.dou-flow-editor').element.dispatchEvent(drop)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await ticks()
    expect(flow.value.nodes[0]!.data).toEqual({ src: '/poster.png', alt: '上海展览海报' })
  })

  it('says so when an upload fails', async () => {
    const flow = ref<FlowDocument>({ nodes: [], edges: [] })
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouFlowEditor, {
            modelValue: flow.value,
            'onUpdate:modelValue': (value: FlowDocument) => (flow.value = value),
            extensions: [
              flowKit(),
              whiteboardKit({
                upload: () => Promise.reject(new Error('offline')),
              }),
            ],
          }),
      ),
      { attachTo: document.body },
    )
    mounted.push(wrapper)
    await ticks()
    const root = wrapper.find('.dou-flow-editor')
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [new File(['x'], 'a.png', { type: 'image/png' })], types: ['Files'] },
    })
    root.element.dispatchEvent(drop)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await ticks()
    expect(flow.value.nodes).toHaveLength(0)
    expect(root.find('[aria-live]').text()).toBe('a.png 没能添加')
  })
})
