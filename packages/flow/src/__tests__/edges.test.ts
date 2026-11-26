import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  bezierEdge,
  defineEdgeType,
  DouFlowEditor,
  flowKit,
  stepEdge,
  straightEdge,
} from '../index'
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

  it('step: no handle when the ends line up', () => {
    const route = stepEdge.route(at(0, 40, 'right'), at(200, 40, 'left'))
    expect(route.handle).toBeUndefined()
    expect(route.path).toBe('M0 40L200 40')
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
    // The built-in types come with flowKit, so the same rule holds for them.
    const step = defineEdgeType({ type: 'step', route: straightEdge.route })
    expect(() => resolveFlowExtensions([flowKit(), { name: 'mine', edgeTypes: [step] }])).toThrow(
      'edge type "step"',
    )
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
  version: 1,
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

const pointer = (type: string, x: number, y = 100) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 3,
  })

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
    // Placed by translate, not transform: transform would sit inside the
    // zoom-compensating scale and move the handle off the line when zoomed.
    const style = (handle.element as HTMLElement).style
    expect(style.transform).toBe('')
    expect(style.translate).toMatch(/^calc\(/)
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

const endpointFlow = (): FlowDocument => ({
  version: 1,
  nodes: [
    {
      id: 'a',
      x: 0,
      y: 0,
      data: { label: '开始', outputs: [{ id: 'out' }, { id: 'alt' }] },
    },
    { id: 'b', x: 300, y: 0, data: { label: '处理', inputs: [{ id: 'in' }] } },
    { id: 'c', x: 300, y: 200, data: { label: '归档', inputs: [{ id: 'in' }] } },
    { id: 'd', x: 0, y: 200, data: { label: '备用源', outputs: [{ id: 'out' }] } },
  ],
  edges: [
    {
      id: 'e1',
      type: 'step',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: '主线',
      data: { bend: 0.4, custom: true },
      points: [{ x: 150, y: 0 }],
    },
  ],
})

async function setupEndpoints(props: Record<string, unknown> = {}) {
  const connected: FlowDocument['edges'][number][] = []
  const res = await setup({
    onConnect: (edge: FlowDocument['edges'][number]) => connected.push(edge),
    ...props,
  })
  res.doc.value = endpointFlow()
  await ticks()
  return { ...res, connected }
}

describe('edge endpoint handles', () => {
  it('shows both endpoint handles only when one edge is selected and editable', async () => {
    const { root, selection, viewport, doc } = await setupEndpoints({ simpleZoom: 0.5 })
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(0)

    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()
    const handles = root.findAll('.dou-flow-editor__edge-end')
    expect(handles.map((el) => el.attributes('data-edge-end'))).toEqual(['source', 'target'])
    for (const handle of handles) {
      expect(handle.attributes('data-edge-id')).toBe('e1')
      expect(handle.attributes('data-flow-handle')).toBeDefined()
      const style = (handle.element as HTMLElement).style
      expect(style.transform).toBe('')
      expect(style.translate).toMatch(/^calc\(/)
    }

    // Hidden while editing the label, zoomed into simple mode, or with multiple selections.
    await root.trigger('keydown', { key: 'Enter' })
    await ticks()
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(0)
    await root.find('.dou-flow-editor__label-input').trigger('keydown', { key: 'Escape' })
    await ticks()
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(2)

    viewport.value = { x: 0, y: 0, zoom: 0.3 }
    await ticks()
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(0)
    viewport.value = { x: 0, y: 0, zoom: 1 }
    await ticks()
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(2)

    doc.value = {
      ...doc.value,
      edges: [
        ...doc.value.edges,
        { id: 'e2', source: { node: 'd', port: 'out' }, target: { node: 'c', port: 'in' } },
      ],
    }
    selection.value = { nodes: [], edges: ['e1', 'e2'] }
    await ticks()
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(0)

    selection.value = { nodes: ['a'], edges: ['e1'] }
    await ticks()
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(0)

    const ro = await setupEndpoints({ readonly: true })
    ro.selection.value = { nodes: [], edges: ['e1'] }
    await ticks()
    expect(ro.root.findAll('.dou-flow-editor__edge-end')).toHaveLength(0)
  })

  it('reconnects the target end while preserving edge metadata, selection and one-step undo', async () => {
    const { root, doc, editor, selection, connected } = await setupEndpoints()
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    const targetHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 300, 120))
    await ticks()
    // Original edge and bend handle hide while dragging; detaching preview shows in empty space.
    expect(root.find('[data-edge-id="e1"]').exists()).toBe(false)
    expect(root.find('.dou-flow-editor__bend').exists()).toBe(false)
    expect(root.find('.dou-flow-editor__edge.is-preview.is-detaching').exists()).toBe(true)
    expect(root.find('.dou-flow-editor__edge-end.is-dragging.is-detaching').exists()).toBe(true)

    // Snap onto node c's input port at (300, 200).
    root.element.dispatchEvent(pointer('pointermove', 300, 200))
    await ticks()
    expect(root.find('.dou-flow-editor__edge.is-preview.is-snapped').exists()).toBe(true)
    expect(root.find('.dou-flow-editor__edge-end.is-dragging').exists()).toBe(false)

    root.element.dispatchEvent(pointer('pointerup', 300, 200))
    await ticks()

    expect(doc.value.edges).toHaveLength(1)
    expect(doc.value.edges[0]).toEqual({
      id: 'e1',
      type: 'step',
      source: { node: 'a', port: 'out' },
      target: { node: 'c', port: 'in' },
      label: '主线',
      data: { bend: 0.4, custom: true },
    })
    expect(selection.value).toEqual({ nodes: [], edges: ['e1'] })
    expect(connected).toHaveLength(1)
    expect(connected[0]!.id).toBe('e1')

    editor.undo()
    await ticks()
    expect(doc.value.edges[0]!.target).toEqual({ node: 'b', port: 'in' })
    expect(doc.value.edges[0]!.points).toEqual([{ x: 150, y: 0 }])

    editor.redo()
    await ticks()
    expect(doc.value.edges[0]!.target).toEqual({ node: 'c', port: 'in' })
  })

  it('reconnects the source end and supports single-step undo/redo', async () => {
    const { root, doc, editor, selection } = await setupEndpoints()
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    const sourceHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="source"]')
    sourceHandle.element.dispatchEvent(pointer('pointerdown', 0, 0))
    root.element.dispatchEvent(pointer('pointermove', 0, 100))
    root.element.dispatchEvent(pointer('pointermove', 0, 200))
    root.element.dispatchEvent(pointer('pointerup', 0, 200))
    await ticks()

    expect(doc.value.edges[0]).toMatchObject({
      id: 'e1',
      source: { node: 'd', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: '主线',
    })
    expect(selection.value).toEqual({ nodes: [], edges: ['e1'] })

    editor.undo()
    await ticks()
    expect(doc.value.edges[0]!.source).toEqual({ node: 'a', port: 'out' })
  })

  it('detaches and removes the edge when dropped on empty canvas, and undoes in one step', async () => {
    const { root, doc, editor, selection } = await setupEndpoints()
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    const targetHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 520, 120))
    root.element.dispatchEvent(pointer('pointerup', 520, 120))
    await ticks()

    expect(doc.value.edges).toHaveLength(0)
    expect(selection.value).toEqual({ nodes: [], edges: [] })
    expect(root.find('.dou-flow-quick-add').exists()).toBe(false)

    editor.undo()
    await ticks()
    expect(doc.value.edges).toHaveLength(1)
    expect(doc.value.edges[0]!.id).toBe('e1')
    expect(selection.value).toEqual({ nodes: [], edges: ['e1'] })
  })

  it('cancels endpoint dragging with Escape without modifying the edge or adding history', async () => {
    const { root, doc, editor, selection } = await setupEndpoints()
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    const targetHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 520, 120))
    await ticks()
    expect(root.find('.dou-flow-editor__edge.is-preview').exists()).toBe(true)

    await root.trigger('keydown', { key: 'Escape' })
    await ticks()

    expect(root.find('.dou-flow-editor__edge.is-preview').exists()).toBe(false)
    expect(doc.value.edges).toHaveLength(1)
    expect(doc.value.edges[0]!.target).toEqual({ node: 'b', port: 'in' })
    expect(selection.value).toEqual({ nodes: [], edges: ['e1'] })
    expect(editor.canUndo).toBe(false)
  })

  it('keeps the edge untouched on plain click, same-port drop, or refused port drop', async () => {
    const { root, doc, editor, selection } = await setupEndpoints()
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    // Plain click without moving past the drag threshold keeps selection and edge intact.
    const targetHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointerup', 300, 0))
    await ticks()
    expect(doc.value.edges).toHaveLength(1)
    expect(selection.value).toEqual({ nodes: [], edges: ['e1'] })
    expect(editor.canUndo).toBe(false)

    // Dragging away and dropping back on the original port creates no undo step.
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 450, 100))
    root.element.dispatchEvent(pointer('pointermove', 300, 0))
    root.element.dispatchEvent(pointer('pointerup', 300, 0))
    await ticks()
    expect(doc.value.edges[0]!.target).toEqual({ node: 'b', port: 'in' })
    expect(editor.canUndo).toBe(false)

    // Dragging target onto its own source node (self-loop refused) leaves the edge intact.
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 0, 0))
    await ticks()
    expect(root.classes()).toContain('is-refused')
    root.element.dispatchEvent(pointer('pointerup', 0, 0))
    await ticks()
    expect(doc.value.edges).toHaveLength(1)
    expect(doc.value.edges[0]!.target).toEqual({ node: 'b', port: 'in' })
    expect(editor.canUndo).toBe(false)
  })

  it('displaces an occupied single-input edge and restores both in one undo step', async () => {
    const { root, doc, editor, selection } = await setupEndpoints()
    doc.value = {
      ...doc.value,
      edges: [
        ...doc.value.edges,
        { id: 'e2', source: { node: 'd', port: 'out' }, target: { node: 'c', port: 'in' } },
      ],
    }
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    const targetHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 300, 200))
    root.element.dispatchEvent(pointer('pointerup', 300, 200))
    await ticks()

    expect(doc.value.edges.map((e) => e.id)).toEqual(['e1'])
    expect(doc.value.edges[0]!.target).toEqual({ node: 'c', port: 'in' })

    editor.undo()
    await ticks()
    expect(doc.value.edges.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(doc.value.edges[0]!.target).toEqual({ node: 'b', port: 'in' })
  })

  it('never detaches when dropped on an incompatible, portless, or single-port self node body, only on empty canvas or container space', async () => {
    const { root, doc, editor, selection } = await setup({ extensions: [flowKit()] })
    doc.value = {
      version: 1,
      nodes: [
        {
          id: 'group',
          type: 'group',
          x: 560,
          y: 0,
          width: 240,
          height: 200,
          data: { label: '分组' },
        },
        {
          id: 'a',
          x: 0,
          y: 0,
          data: { label: '源', outputs: [{ id: 'out', dataType: 'text' }] },
        },
        {
          id: 'b',
          x: 300,
          y: 0,
          data: { label: '目标', inputs: [{ id: 'in', dataType: 'text' }] },
        },
        {
          id: 'bad',
          x: 300,
          y: 200,
          data: { label: '数字节点', inputs: [{ id: 'num', dataType: 'number' }] },
        },
        {
          id: 'plain',
          x: 0,
          y: 200,
          data: { label: '无端口' },
        },
      ],
      edges: [{ id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
    }
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    // 1. Drop in the middle of an incompatible node (>24px away from its port at x=300): refused, not detached.
    const dragTargetTo = async (x: number, y: number) => {
      const targetHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
      targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 30))
      root.element.dispatchEvent(pointer('pointermove', x, y))
      await ticks()
      const state = {
        refused: root.classes().includes('is-refused'),
        detaching: root.find('.dou-flow-editor__edge.is-preview.is-detaching').exists(),
      }
      root.element.dispatchEvent(pointer('pointerup', x, y))
      await ticks()
      return state
    }

    const onBad = await dragTargetTo(420, 230)
    expect(onBad).toEqual({ refused: true, detaching: false })
    expect(doc.value.edges).toHaveLength(1)
    expect(root.find('[aria-live]').text()).toBe('端口类型不匹配')
    expect(editor.canUndo).toBe(false)

    // 2. Drop on a portless node body: refused, not detached.
    const onPlain = await dragTargetTo(100, 230)
    expect(onPlain).toEqual({ refused: true, detaching: false })
    expect(doc.value.edges).toHaveLength(1)
    expect(root.find('[aria-live]').text()).toBe('没有可以连接的端口')
    expect(editor.canUndo).toBe(false)

    // 3. Drop in the middle of its own single-port source node body: refused, not detached.
    const onSelf = await dragTargetTo(100, 30)
    expect(onSelf).toEqual({ refused: true, detaching: false })
    expect(doc.value.edges).toHaveLength(1)
    expect(root.find('[aria-live]').text()).toBe('不能连到同一个节点')
    expect(editor.canUndo).toBe(false)

    // 4. Drop in empty space inside a container node: detaches as empty canvas.
    const onContainerEmpty = await dragTargetTo(650, 100)
    expect(onContainerEmpty).toEqual({ refused: false, detaching: true })
    expect(doc.value.edges).toHaveLength(0)
  })

  it('hides endpoint handles whose fixed end has no valid portSpec, while letting stale edges fix their broken end', async () => {
    const { root, doc, selection } = await setupEndpoints()
    // 1. Stale edge: source port 'removed' is gone, target port 'in' is still valid.
    doc.value = {
      ...doc.value,
      edges: [
        {
          id: 'stale',
          source: { node: 'a', port: 'removed' },
          target: { node: 'b', port: 'in' },
        },
      ],
    }
    selection.value = { nodes: [], edges: ['stale'] }
    await ticks()
    // Only the broken source end has a draggable handle (its fixed target b.in is valid).
    expect(
      root.findAll('.dou-flow-editor__edge-end').map((el) => el.attributes('data-edge-end')),
    ).toEqual(['source'])

    // Dragging the broken source handle to d.out repairs the edge.
    const srcHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="source"]')
    srcHandle.element.dispatchEvent(pointer('pointerdown', 200, 30))
    root.element.dispatchEvent(pointer('pointermove', 0, 200))
    root.element.dispatchEvent(pointer('pointerup', 0, 200))
    await ticks()
    expect(doc.value.edges[0]!.source).toEqual({ node: 'd', port: 'out' })
    expect(
      root.findAll('.dou-flow-editor__edge-end').map((el) => el.attributes('data-edge-end')),
    ).toEqual(['source', 'target'])

    // 2. Edge between two portless nodes shows no endpoint handles at all.
    doc.value = {
      version: 1,
      nodes: [
        { id: 'p1', x: 0, y: 0, data: { label: '甲' } },
        { id: 'p2', x: 300, y: 0, data: { label: '乙' } },
      ],
      edges: [{ id: 'plain-edge', source: { node: 'p1' }, target: { node: 'p2' } }],
    }
    selection.value = { nodes: [], edges: ['plain-edge'] }
    await ticks()
    expect(root.findAll('.dou-flow-editor__edge-end')).toHaveLength(0)
  })

  it('treats omitted-port edges consistently on origin drop, duplicate detection, and port capacity displacement', async () => {
    const { root, doc, editor, selection, connected } = await setupEndpoints()
    doc.value = {
      ...doc.value,
      edges: [
        { id: 'e1', source: { node: 'a' }, target: { node: 'b' } },
        { id: 'e2', source: { node: 'a' }, target: { node: 'c' } },
      ],
    }
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()

    // 1. Dragging target away and dropping back onto its resolved origin (b.in) makes no change or undo step.
    const targetHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 450, 100))
    root.element.dispatchEvent(pointer('pointermove', 300, 0))
    root.element.dispatchEvent(pointer('pointerup', 300, 0))
    await ticks()
    expect(doc.value.edges[0]).toEqual({ id: 'e1', source: { node: 'a' }, target: { node: 'b' } })
    expect(connected).toHaveLength(0)
    expect(editor.canUndo).toBe(false)

    // 2. Dragging e1's target onto c.in is refused as duplicate because e2 already joins a -> c with omitted ports.
    targetHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 300, 200))
    await ticks()
    expect(root.classes()).toContain('is-refused')
    expect(root.find('.dou-flow-editor__edge.is-preview.is-snapped').exists()).toBe(false)
    root.element.dispatchEvent(pointer('pointerup', 300, 200))
    await ticks()
    expect(root.find('[aria-live]').text()).toBe('这两个端口已经连上了')
    expect(doc.value.edges).toEqual([
      { id: 'e1', source: { node: 'a' }, target: { node: 'b' } },
      { id: 'e2', source: { node: 'a' }, target: { node: 'c' } },
    ])
    expect(editor.canUndo).toBe(false)

    // 3. When c is occupied by an omitted-port edge from a different source (d -> c), reconnecting e1 displaces it.
    doc.value = {
      ...doc.value,
      edges: [
        { id: 'e1', source: { node: 'a' }, target: { node: 'b' } },
        { id: 'e3', source: { node: 'd' }, target: { node: 'c' } },
      ],
    }
    selection.value = { nodes: [], edges: ['e1'] }
    await ticks()
    const nextHandle = root.find('.dou-flow-editor__edge-end[data-edge-end="target"]')
    nextHandle.element.dispatchEvent(pointer('pointerdown', 300, 0))
    root.element.dispatchEvent(pointer('pointermove', 300, 200))
    root.element.dispatchEvent(pointer('pointerup', 300, 200))
    await ticks()
    expect(doc.value.edges).toEqual([
      { id: 'e1', source: { node: 'a' }, target: { node: 'c', port: 'in' } },
    ])
  })
})

describe('edges from the keyboard', () => {
  it("E goes through the selected node's edges and says which nodes they join", async () => {
    const { root, doc, selection } = await setup()
    doc.value = {
      ...doc.value,
      edges: [
        ...doc.value.edges,
        { id: 'back', source: { node: 'b', port: 'out' }, target: { node: 'a', port: 'in' } },
      ],
    }
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    const live = () => root.find('[aria-live]').text()
    const press = async (shiftKey = false) => {
      await root.trigger('keydown', { key: 'e', shiftKey })
      await ticks()
    }
    await press()
    expect(selection.value).toEqual({ nodes: [], edges: ['e'] })
    expect(live()).toBe('连线：读取笔记 → 发布，标签：摘要')
    await press()
    expect(selection.value.edges).toEqual(['back'])
    expect(live()).toBe('连线：发布 → 读取笔记')
    await press()
    expect(selection.value.edges).toEqual(['e'])
    await press(true)
    expect(selection.value.edges).toEqual(['back'])
    // Then Enter edits its label and Delete removes it.
    await root.trigger('keydown', { key: 'Delete' })
    await ticks()
    expect(doc.value.edges.map((e) => e.id)).toEqual(['e', 'gone'])
  })

  it('says when the node has no edges, and announces a saved label', async () => {
    const { root, doc, selection } = await setup()
    const edges = doc.value.edges
    doc.value = { ...doc.value, edges: [] }
    selection.value = { nodes: ['a'], edges: [] }
    await ticks()
    await root.trigger('keydown', { key: 'e' })
    await ticks()
    expect(root.find('[aria-live]').text()).toBe('这个节点没有连线')
    doc.value = { ...doc.value, edges }
    selection.value = { nodes: [], edges: ['e'] }
    await ticks()
    await root.trigger('keydown', { key: 'Enter' })
    await ticks()
    const input = root.find<HTMLInputElement>('.dou-flow-editor__label-input')
    await input.setValue('新标签')
    await input.trigger('keydown', { key: 'Enter' })
    await ticks()
    expect(root.find('[aria-live]').text()).toBe('已保存标签')
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
    // Further out, names would be a few px tall: only the boxes.
    viewport.value = { x: 0, y: 0, zoom: 0.15 }
    await ticks()
    expect(root.findAll('.dou-flow-editor__simple').length).toBeGreaterThan(0)
    expect(root.find('.dou-flow-editor__simple-label').exists()).toBe(false)
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
