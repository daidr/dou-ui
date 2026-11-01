import { describe, expect, it } from 'vitest'
import { acyclic, layoutGraph, rank } from '../layout'

const size = (id: string, width = 80) => ({ id, width, height: 32 })
const options = { rankGap: 56, laneGap: 20 }

describe('layoutGraph', () => {
  it('puts each node one column after its furthest predecessor', () => {
    const { order, edges } = acyclic(
      ['a', 'b', 'c', 'd'],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'a', to: 'c' },
        { from: 'd', to: 'c' },
      ],
    )
    const column = rank(order, edges)
    expect(Object.fromEntries(column)).toEqual({ a: 0, b: 1, c: 2, d: 1 })
  })

  it('drops the edge that closes a cycle, and edges to unknown nodes', () => {
    const result = acyclic(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
        { from: 'a', to: 'x' },
      ],
    )
    expect(result.dropped).toEqual([{ from: 'c', to: 'a' }])
    expect(result.edges).toHaveLength(2)
  })

  it('lays columns out left to right and centres a fan-out on its source', () => {
    const layout = layoutGraph(
      [size('a'), size('b', 120), size('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
      options,
    )
    const [a, b, c] = ['a', 'b', 'c'].map((id) => layout.nodes.get(id)!)
    expect(a!.x).toBe(0)
    expect(b!.x).toBe(80 + 56)
    // column width is the widest node
    expect(c!.width).toBe(120)
    expect(c!.y - b!.y).toBe(32 + 20)
    expect(a!.y + 16).toBe((b!.y + c!.y + 32) / 2)
    expect(layout.width).toBe(80 + 56 + 120)
    expect(layout.height).toBe(32 * 2 + 20)
  })

  it('lays ranks out top to bottom when vertical, fanning out symmetrically', () => {
    const layout = layoutGraph(
      [size('a'), size('b', 120), size('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
      { ...options, direction: 'vertical', equalWidth: false, grid: 70 },
    )
    const [a, b, c] = ['a', 'b', 'c'].map((id) => layout.nodes.get(id)!)
    expect(a!.y).toBe(0)
    expect(b!.y).toBe(32 + 56)
    expect(c!.y).toBe(b!.y)
    expect(b!.width).toBe(120)
    // siblings a whole lane (two grid steps) apart, the source halfway
    expect(c!.x + 40 - (b!.x + 60)).toBe(140)
    expect(a!.x + 40).toBe((b!.x + 60 + c!.x + 40) / 2)
    expect(layout.height).toBe(32 + 56 + 32)
    expect(layout.width).toBe(c!.x + 80 - b!.x)
    // from the bottom middle of `a` to the top middle of `b`
    const path = layout.edges.find((e) => e.to === 'b')!.path
    expect(path.startsWith(`M${a!.x + 40} 32C`)).toBe(true)
    expect(path.endsWith(`${b!.x + 60} ${b!.y}`)).toBe(true)
  })

  it('fans out symmetrically when one sibling is a bit wider, with evenSpacing', () => {
    const layout = layoutGraph(
      [size('p'), size('a', 98), size('b', 98), size('c', 98), size('d', 112)],
      ['a', 'b', 'c', 'd'].map((to) => ({ from: 'p', to })),
      { ...options, direction: 'vertical', equalWidth: false, grid: 26, evenSpacing: true },
    )
    const centre = (id: string) => {
      const n = layout.nodes.get(id)!
      return n.x + n.width / 2
    }
    const xs = ['a', 'b', 'c', 'd'].map(centre)
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!)
    expect(new Set(gaps).size).toBe(1)
    expect(centre('p')).toBe((xs[0]! + xs[3]!) / 2)
  })

  it('runs a long edge down through the ranks it crosses when vertical', () => {
    const layout = layoutGraph(
      [size('a'), size('b'), size('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'a', to: 'c' },
      ],
      { ...options, direction: 'vertical', equalWidth: false },
    )
    const path = layout.edges.find((e) => e.from === 'a' && e.to === 'c')!.path
    expect(path).toMatch(/V\d/)
    expect(path).not.toMatch(/H/)
  })

  it('keeps node widths with equalWidth off', () => {
    const layout = layoutGraph(
      [size('a'), size('b', 120), size('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
      { ...options, equalWidth: false },
    )
    expect(layout.nodes.get('c')!.width).toBe(80)
  })

  it('routes a long edge through the columns it crosses', () => {
    const layout = layoutGraph(
      [size('a'), size('b'), size('c'), size('d')],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
        { from: 'a', to: 'd' },
      ],
      options,
    )
    const long = layout.edges.find((e) => e.from === 'a' && e.to === 'd')!
    // three gaps and two waypoint columns; the columns are crossed straight
    const segments = long.path.match(/[HC][^HC]*/g)!
    expect(segments).toHaveLength(5)
    expect(segments[1]!.startsWith('H')).toBe(true)
    expect(segments[3]!.startsWith('H')).toBe(true)
    expect(long.path.startsWith('M80 ')).toBe(true)
  })

  it('avoids crossings where it can', () => {
    const layout = layoutGraph(
      ['a', 'b', 'c', 'd'].map((id) => size(id)),
      [
        { from: 'a', to: 'd' },
        { from: 'b', to: 'c' },
      ],
      options,
    )
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => layout.nodes.get(id)!.y)
    expect(Math.sign(a! - b!)).toBe(Math.sign(d! - c!))
  })

  it('puts every centre on the row grid and tops on even pixels', () => {
    const layout = layoutGraph(
      [size('a'), { id: 'b', width: 80, height: 60 }, size('c'), size('d')],
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'a', to: 'd' },
      ],
      options,
    )
    const origin = layout.nodes.get('a')!
    const centre = (id: string) => {
      const node = layout.nodes.get(id)!
      return node.y + node.height / 2 - (origin.y + origin.height / 2)
    }
    for (const node of layout.nodes.values()) {
      expect(node.y % 2).toBe(0)
      expect(Math.abs(centre(node.id) % 26)).toBe(0)
    }
  })

  it('fans out symmetrically', () => {
    const layout = layoutGraph(
      ['a', 'b', 'c', 'd', 'e'].map((id) => size(id)),
      ['b', 'c', 'd', 'e'].map((to) => ({ from: 'a', to })),
      options,
    )
    const centre = (id: string) => layout.nodes.get(id)!.y + 16
    expect(centre('b') + centre('e')).toBe(2 * centre('a'))
    expect(centre('c') + centre('d')).toBe(2 * centre('a'))
    expect(centre('c') - centre('b')).toBe(52)
  })

  it('keeps a long edge level when nothing is in its way', () => {
    const layout = layoutGraph(
      ['a', 'b', 'c', 'd'].map((id) => size(id)),
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
        { from: 'a', to: 'd' },
      ],
      options,
    )
    const long = layout.edges.find((e) => e.from === 'a' && e.to === 'd')!
    // it bends once on the way out and once on the way in, straight in between
    expect(long.path.match(/C/g)).toHaveLength(2)
  })

  it('lines edges and rows up on the anchor of a tall node', () => {
    const layout = layoutGraph(
      [size('a'), { id: 'b', width: 80, height: 60, anchor: 16 }, size('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
      options,
    )
    const a = layout.nodes.get('a')!
    const b = layout.nodes.get('b')!
    const c = layout.nodes.get('c')!
    // the title row of the tall node is level with its neighbours
    expect(b.y + 16).toBe(a.y + 16)
    expect(c.y).toBe(a.y)
    for (const edge of layout.edges) expect(edge.path).not.toContain('C')
    expect(layout.edges.find((e) => e.from === 'b')!.path).toMatch(
      new RegExp(`^M\\S+ ${b.y + 16}H`),
    )
  })

  it('fans out symmetrically to tall nodes', () => {
    for (const [upper, lower] of [
      [56, 56],
      [88, 88],
      [32, 56],
      [72, 32],
    ]) {
      const layout = layoutGraph(
        [
          size('a'),
          { id: 'b', width: 80, height: upper!, anchor: 16 },
          { id: 'c', width: 80, height: lower!, anchor: 16 },
        ],
        [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
        ],
        options,
      )
      const row = (id: string) => layout.nodes.get(id)!.y + 16
      expect(row('a') - row('b')).toBe(row('c') - row('a'))
    }
  })

  it('handles an empty graph', () => {
    const layout = layoutGraph([], [], options)
    expect(layout.width).toBe(0)
    expect(layout.height).toBe(0)
  })
})
