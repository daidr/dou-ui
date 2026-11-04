import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { bezierEdge, DouFlowEditor, FlowTransaction, stepEdge, straightEdge } from '../index'
import type { FlowDocument, FlowEdge } from '../index'

const port = (kind: 'input' | 'output') => [
  { id: kind === 'input' ? 'in' : 'out', side: kind === 'input' ? 'top' : 'bottom', max: 9 },
]
const node = (id: string, x = 0, y = 0) => ({
  id,
  x,
  y,
  width: 160,
  data: { label: id, inputs: port('input'), outputs: port('output') },
})
const edge = (id: string, from: string, to: string): FlowEdge => ({
  id,
  source: { node: from, port: 'out' },
  target: { node: to, port: 'in' },
})

// jsdom lays nothing out: give every element a size so nodes get measured.
const descriptors = new Map<string, PropertyDescriptor | undefined>()
const sizes: Record<string, number> = {
  offsetWidth: 160,
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

function setup(initial: FlowDocument, props: Record<string, unknown> = {}) {
  const doc = ref(initial)
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouFlowEditor, {
          modelValue: doc.value,
          'onUpdate:modelValue': (value: FlowDocument) => (doc.value = value),
          direction: 'vertical',
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  const editor = wrapper.findComponent(DouFlowEditor).vm as any
  return { wrapper, editor, doc }
}

// Mount, measure, then draw what is in view.
const ticks = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}

/** The numbers of an SVG path, as points. */
const points = (path: string) => {
  const n = path.match(/-?[\d.]+/g)!.map(Number)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < n.length; i += 2) out.push({ x: n[i]!, y: n[i + 1]! })
  return out
}

const chain = (): FlowDocument => ({
  version: 1,
  nodes: [node('a'), node('b', 300, 40), node('c', 40, 300)],
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ac', 'a', 'c')],
})

describe('tidy routes', () => {
  it('runs an edge spanning several ranks between the nodes in its way, as one undo step', async () => {
    const { editor, doc } = setup(chain())
    await ticks()
    editor.tidy()
    await ticks()
    const long = doc.value.edges.find((e) => e.id === 'ac')!
    expect(long.points).toHaveLength(2)
    const b = doc.value.nodes.find((n) => n.id === 'b')!
    // Beside b, from its top to its bottom.
    expect(long.points![0]!.x).toBe(long.points![1]!.x)
    expect(long.points![1]!.y).toBeGreaterThanOrEqual(long.points![0]!.y)
    expect(long.points![0]!.y).toBe(b.y)
    expect(doc.value.edges.find((e) => e.id === 'ab')!.points).toBeUndefined()
    editor.undo()
    expect(doc.value).toEqual(chain())
  })

  it('draws an edge through its points', async () => {
    const withPoints = chain()
    withPoints.edges[2] = {
      ...withPoints.edges[2]!,
      points: [
        { x: 600, y: 100 },
        { x: 600, y: 200 },
      ],
    }
    const { wrapper } = setup(withPoints)
    await ticks()
    const path = wrapper.find('[data-edge-id="ac"] path').attributes('d')
    expect(path).toContain('600 100')
    expect(path).toContain('L600 200')
  })

  it('drops the points when either end moves', () => {
    const tr = new FlowTransaction({
      version: 1,
      nodes: [node('a'), node('c', 0, 300)],
      edges: [{ ...edge('ac', 'a', 'c'), points: [{ x: 200, y: 100 }] }],
    })
    tr.moveNode('a', 0, 0)
    expect(tr.getEdge('ac')!.points).toHaveLength(1)
    tr.moveNode('c', 0, 320)
    expect(tr.getEdge('ac')!.points).toBeUndefined()
  })
})

const fan = (): FlowDocument => ({
  version: 1,
  nodes: [node('a', -200, 0), node('b', 0, 0), node('c', 200, 0), node('m', 0, 200)],
  edges: [edge('cm', 'c', 'm'), edge('am', 'a', 'm'), edge('bm', 'b', 'm')],
})
const ends = (wrapper: ReturnType<typeof setup>['wrapper']) =>
  ['am', 'bm', 'cm'].map((id) =>
    points(wrapper.find(`[data-edge-id="${id}"] path`).attributes('d')!).at(-1)!,
  )

describe('edges at one port', () => {
  it('all meet in the port', async () => {
    const { wrapper } = setup(fan())
    await ticks()
    const xs = new Set(ends(wrapper).map((p) => p.x))
    expect(xs.size).toBe(1)
  })
})

describe('edge types through points', () => {
  const source = { x: 0, y: 0, side: 'bottom' as const }
  const target = { x: 0, y: 300, side: 'top' as const }
  const through = {
    ...edge('e', 'a', 'b'),
    points: [
      { x: 100, y: 100 },
      { x: 100, y: 200 },
    ],
  }

  it('passes every point', () => {
    const step = points(stepEdge.route(source, target, through).path)
    // Right angles: one run down beside the points, from above the first to below the last.
    const run = step.filter((p) => p.x === 100).map((p) => p.y)
    expect(Math.min(...run)).toBeLessThanOrEqual(100)
    expect(Math.max(...run)).toBeGreaterThanOrEqual(200)
    for (const type of [bezierEdge, straightEdge]) {
      const route = type.route(source, target, through)
      const at = points(route.path)
      for (const p of through.points)
        expect(at.some((q) => Math.abs(q.x - p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01)).toBe(true)
      expect(route.label).toEqual({ x: 100, y: 150 })
    }
  })

  it('runs straight along a rank', () => {
    const route = bezierEdge.route(source, target, through)
    expect(route.path).toContain('L100 200')
  })
})
