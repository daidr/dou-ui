import { describe, expect, it } from 'vitest'
import { acyclic, layoutFlow, rank } from '../layout'

const size = (id: string, width = 80) => ({ id, width, height: 32 })
const options = { columnGap: 56, rowGap: 20 }

describe('layoutFlow', () => {
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
    const layout = layoutFlow(
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

  it('keeps node widths with equalWidth off', () => {
    const layout = layoutFlow(
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
    const layout = layoutFlow(
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
    const layout = layoutFlow(
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
    const layout = layoutFlow(
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
    const layout = layoutFlow(
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
    const layout = layoutFlow(
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

  it('handles an empty graph', () => {
    const layout = layoutFlow([], [], options)
    expect(layout.width).toBe(0)
    expect(layout.height).toBe(0)
  })
})
