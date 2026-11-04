import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
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

const twoLongEdges = (): FlowDocument => ({
  version: 1,
  nodes: [
    {
      ...node('a'),
      data: {
        label: 'a',
        outputs: [
          { id: 'o1', side: 'bottom' },
          { id: 'o2', side: 'bottom' },
        ],
      },
    },
    node('b', 300, 40),
    node('c', 40, 300),
  ],
  edges: [
    edge('ab', 'a', 'b'),
    edge('bc', 'b', 'c'),
    { id: 'c1', source: { node: 'a', port: 'o1' }, target: { node: 'c', port: 'in' } },
    { id: 'c2', source: { node: 'a', port: 'o2' }, target: { node: 'c', port: 'in' } },
  ],
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

  it.each([
    ['in the middle of every node', 80],
    ['nearer the side of the last node', 60],
  ])(
    'runs a long edge straight from port to port with ports %s, off the grid lines',
    async (_, last) => {
      // Ports 80px into the 160px wide nodes, or `last` into `d`, top and bottom.
      const portAt = (id: string) => (id === 'd' ? last : 80)
      const rect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect')!
      Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
        configurable: true,
        value(this: Element) {
          if (!this.classList.contains('dou-flow-port')) return rect.value.call(this)
          const id = this.closest('[data-node-id]')!.getAttribute('data-node-id')!
          const top = this.classList.contains('is-bottom') ? 60 : 0
          return DOMRect.fromRect({ x: portAt(id) - 4, y: top - 4, width: 8, height: 8 })
        },
      })
      onTestFinished(() => {
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', rect)
      })
      const { editor, doc } = setup(
        {
          version: 1,
          nodes: [node('a'), node('b', 300, 40), node('c', 40, 300), node('d', 200, 500)],
          edges: [
            edge('ab', 'a', 'b'),
            edge('ac', 'a', 'c'),
            edge('bd', 'b', 'd'),
            edge('cd', 'c', 'd'),
            edge('ad', 'a', 'd'),
          ],
        },
        // 80 and 60 both sit between the lines of a 24px grid.
        { grid: 24 },
      )
      await ticks()
      editor.tidy()
      await ticks()
      const at = (id: string) => doc.value.nodes.find((n) => n.id === id)!.x + portAt(id)
      const long = doc.value.edges.find((e) => e.id === 'ad')!
      expect(long.points).toHaveLength(2)
      expect(at('d')).toBe(at('a'))
      for (const p of long.points!) expect(p.x).toBe(at('a'))
    },
  )

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

  it('moves the points along when both ends move together, else drops them', () => {
    const tr = new FlowTransaction({
      version: 1,
      nodes: [node('a'), node('b', 0, 150), node('c', 0, 300)],
      edges: [{ ...edge('ac', 'a', 'c'), points: [{ x: 200, y: 100 }] }],
    })
    tr.moveNode('a', 10, 20)
    expect(tr.getEdge('ac')!.points).toBeUndefined()
    tr.moveNode('c', 10, 320)
    expect(tr.getEdge('ac')!.points).toEqual([{ x: 210, y: 120 }])
    // A node the edge only passes by doesn't count.
    tr.moveNode('b', 50, 150)
    expect(tr.getEdge('ac')!.points).toEqual([{ x: 210, y: 120 }])
  })

  it('runs long edges between the same two nodes side by side', async () => {
    const { editor, doc } = setup(twoLongEdges())
    await ticks()
    editor.tidy()
    const [p1, p2] = ['c1', 'c2'].map((id) => doc.value.edges.find((e) => e.id === id)!.points!)
    expect(p2![0]!.x - p1![0]!.x).toBe(8)
    expect(p2![0]!.y).toBe(p1![0]!.y)
  })

  it('carries the points along with a copy', async () => {
    const { wrapper, editor, doc } = setup(chain(), {
      selection: { nodes: ['a', 'b', 'c'], edges: [] },
    })
    await ticks()
    editor.tidy()
    await ticks()
    const before = doc.value.edges.find((e) => e.id === 'ac')!.points!
    await wrapper.find('.dou-flow-toolbar button[aria-label="复制一份"]').trigger('click')
    const copy = doc.value.edges.at(-1)!
    expect(copy.id).not.toBe('ac')
    expect(copy.points).toEqual(before.map((p) => ({ x: p.x + 24, y: p.y + 24 })))
  })

  it('ignores the points when a folded container stands in for an end', async () => {
    const folded: FlowDocument = {
      version: 1,
      nodes: [
        node('a'),
        {
          id: 'g',
          type: 'group',
          x: 300,
          y: 300,
          width: 300,
          height: 200,
          data: { label: '组', collapsed: true },
        },
        { ...node('c', 320, 340), parent: 'g' },
      ],
      edges: [{ ...edge('ac', 'a', 'c'), points: [{ x: 777, y: 400 }] }],
    }
    const { wrapper } = setup(folded)
    await ticks()
    const path = wrapper.find('[data-edge-id="ac"] path').attributes('d')!
    expect(path).not.toContain('777')
  })

  it('treats a change of position through updateNode as a move', () => {
    const tr = new FlowTransaction({
      version: 1,
      nodes: [node('a'), node('c', 0, 300)],
      edges: [{ ...edge('ac', 'a', 'c'), points: [{ x: 200, y: 100 }] }],
    })
    tr.updateNode('a', { x: 50 })
    expect(tr.getEdge('ac')!.points).toBeUndefined()
    tr.updateNode('c', { x: 50 })
    expect(tr.getEdge('ac')!.points).toEqual([{ x: 250, y: 100 }])
  })

  it('drops the points when either end is resized', () => {
    const tr = new FlowTransaction({
      version: 1,
      nodes: [node('a'), node('c', 0, 300)],
      edges: [{ ...edge('ac', 'a', 'c'), points: [{ x: 200, y: 100 }] }],
    })
    tr.updateNode('a', { width: 160 })
    expect(tr.getEdge('ac')!.points).toHaveLength(1)
    tr.updateNode('a', { width: 200 })
    expect(tr.getEdge('ac')!.points).toBeUndefined()
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

// 2000 nodes in a column, each edge with two points: moving every node in
// one transaction (dragging all, or tidy) looks each node and edge up once.
const column = (n: number): FlowDocument => ({
  version: 1,
  nodes: Array.from({ length: n }, (_, i) => node(`n${i}`, 0, i * 100)),
  edges: Array.from({ length: n - 1 }, (_, i) => ({
    ...edge(`e${i}`, `n${i}`, `n${i + 1}`),
    points: [
      { x: 80, y: i * 100 + 40 },
      { x: 80, y: i * 100 + 60 },
    ],
  })),
})

describe('moving a large graph', () => {
  it('stays linear in one transaction', () => {
    const initial = column(2000)
    const start = performance.now()
    const tr = new FlowTransaction(initial)
    for (const n of initial.nodes) tr.moveNode(n.id, n.x + 40, n.y + 20)
    const after = tr.doc
    const took = performance.now() - start
    // Every edge kept its points, carried with both ends.
    expect(after.edges[1000]?.points).toEqual([
      { x: 120, y: 100_060 },
      { x: 120, y: 100_080 },
    ])
    // About 15ms here; scanning the document per move took over half a second.
    expect(took).toBeLessThan(200)
  })

  it('removes half of it in one transaction', () => {
    const initial = column(2000)
    const start = performance.now()
    const tr = new FlowTransaction(initial)
    for (const n of initial.nodes.slice(0, 1000)) tr.removeNode(n.id)
    const after = tr.doc
    const took = performance.now() - start
    expect(after.nodes).toHaveLength(1000)
    expect(after.edges).toHaveLength(999)
    expect(tr.getNode('n1500')).toBe(after.nodes[500])
    expect(tr.edgesOf('n1000').map((e) => e.id)).toEqual(['e1000'])
    // About 60ms here; rebuilding the indexes on every removal took two seconds.
    expect(took).toBeLessThan(400)
  })
})
