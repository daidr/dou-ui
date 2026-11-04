import { describe, expect, it } from 'vitest'
import { acyclic, centreLongEdges, layoutGraph, rank } from '../layout'

const size = (id: string, width = 80) => ({ id, width, height: 32 })
const options = { rankGap: 56, laneGap: 20 }

const fan = (widths: number[]) => {
  const ids = widths.map((_, i) => `c${i}`)
  const layout = layoutGraph(
    [size('p'), ...widths.map((w, i) => size(ids[i]!, w))],
    ids.map((to) => ({ from: 'p', to })),
    { ...options, direction: 'vertical', equalWidth: false, grid: 26 },
  )
  const centre = (id: string) => {
    const n = layout.nodes.get(id)!
    return n.x + n.width / 2
  }
  const xs = layout.ranks[1]!.map(centre)
  return { layout, xs, gaps: xs.slice(1).map((x, i) => x - xs[i]!), parent: centre('p') }
}

const chainWithLongEdge = (straightChains: boolean) =>
  layoutGraph(
    [size('a'), size('b'), size('c')],
    [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' },
    ],
    { ...options, direction: 'vertical', straightChains },
  )

const smallGraph = (spec: string, straightChains: boolean) => {
  const edges = spec.split(',').map((pair) => {
    const [from, to] = pair.split('>')
    return { from: from!, to: to! }
  })
  const ids = [...new Set(edges.flatMap((e) => [e.from, e.to]))]
  return layoutGraph(
    ids.map((id) => ({ id, width: 160, height: 32 })),
    edges,
    { rankGap: 48, laneGap: 24, grid: 28, equalWidth: false, straightChains },
  )
}

const middle = (layout: ReturnType<typeof layoutGraph>, id: string) => {
  const n = layout.nodes.get(id)!
  return n.x + n.width / 2
}

const throughFan = (siblings: string[]) => {
  const edges = [
    ...siblings.map((to) => ({ from: 'a', to })),
    ...siblings.map((from) => ({ from, to: 'z' })),
  ]
  edges.push({ from: 'a', to: 'z' })
  return layoutGraph(
    ['a', ...siblings, 'z'].map((id) => ({ id, width: 80, height: 32 })),
    edges,
    { ...options, direction: 'vertical', equalWidth: false },
  )
}

type Layers = Parameters<typeof centreLongEdges>[0]
const item = (id: string, edge = -1): Layers[number][number] => ({
  id,
  edge,
  height: edge < 0 ? 32 : 0,
  anchor: edge < 0 ? 16 : 0,
  preds: [],
  succs: [],
  y: 0,
})
const link = (from: Layers[number][number], to: Layers[number][number]) => {
  from.succs.push(to)
  to.preds.push(from)
}

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

  it('fans out symmetrically when one sibling is a bit wider', () => {
    const { xs, gaps, parent } = fan([98, 98, 98, 112])
    expect(gaps).toEqual(gaps.toReversed())
    expect(parent).toBe((xs[0]! + xs.at(-1)!) / 2)
  })

  it('keeps a two-level fan symmetric top to bottom with a wider node', () => {
    const layout = layoutGraph(
      [size('r'), size('a'), size('b', 112), size('a1'), size('a2', 120), size('b1'), size('b2')],
      [
        { from: 'r', to: 'a' },
        { from: 'r', to: 'b' },
        { from: 'a', to: 'a1' },
        { from: 'a', to: 'a2' },
        { from: 'b', to: 'b1' },
        { from: 'b', to: 'b2' },
      ],
      { ...options, direction: 'vertical', equalWidth: false, grid: 26 },
    )
    const x = (id: string) => {
      const n = layout.nodes.get(id)!
      return n.x + n.width / 2
    }
    expect(x('r')).toBe((x('a') + x('b')) / 2)
    expect(x('a')).toBe((x('a1') + x('a2')) / 2)
    expect(x('b')).toBe((x('b1') + x('b2')) / 2)
  })

  it('runs a long edge straight down the middle of a fan into the node it merges into', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
      { from: 'a', to: 'd' },
    ]
    const small = layoutGraph([size('a'), size('b', 112), size('c'), size('d')], edges, {
      ...options,
      direction: 'vertical',
      equalWidth: false,
      grid: 26,
    })
    const long = small.edges.find((e) => e.from === 'a' && e.to === 'd')!
    const [b, c] = small.ranks[1]!.map((id) => small.nodes.get(id)!)
    expect(long.points[0]!.x).toBeGreaterThan(b!.x + b!.width)
    expect(long.points[0]!.x).toBeLessThan(c!.x)
    expect(long.path).not.toMatch(/C/)
    expect(middle(small, 'a')).toBe(long.points[0]!.x)
    expect(middle(small, 'd')).toBe(long.points[0]!.x)

    // With wide nodes it is narrower too: two nodes and two lane gaps, not
    // 776 with the long edge mirroring a node on the far side.
    for (const straightChains of [false, true]) {
      const wide = layoutGraph(
        ['a', 'b', 'c', 'd'].map((id) => ({ id, width: 272, height: 64 })),
        edges,
        {
          direction: 'vertical',
          rankGap: 56,
          laneGap: 40,
          equalWidth: false,
          grid: 8,
          straightChains,
        },
      )
      expect(wide.width).toBe(272 * 2 + 40 * 2)
      expect(wide.edges.find((e) => e.from === 'a' && e.to === 'd')!.path).not.toMatch(/C/)
    }
  })

  it('runs a long edge down the middle only of an even fan', () => {
    const even = throughFan(['b', 'c', 'd', 'e'])
    const [b, c, d, e] = even.ranks[1]!.map((id) => even.nodes.get(id)!)
    const long = even.edges.find((edge) => edge.from === 'a' && edge.to === 'z')!
    expect(long.points[0]!.x).toBeGreaterThan(c!.x + c!.width)
    expect(long.points[0]!.x).toBeLessThan(d!.x)
    expect(long.path).not.toMatch(/C/)
    expect(c!.x - b!.x).toBe(e!.x - d!.x)
    // With three nodes a node is in the middle: the edge would have to bend
    // between two of them and wedge them apart, so it stays outside.
    const odd = layoutGraph(
      ['a', 'b', 'c', 'e', 'd'].map((id) => ({ id, width: 160, height: 40 })),
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'a', to: 'e' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
        { from: 'e', to: 'd' },
        { from: 'a', to: 'd' },
      ],
      {
        direction: 'vertical',
        rankGap: 56,
        laneGap: 40,
        equalWidth: false,
        grid: 8,
        straightChains: true,
      },
    )
    const nodes = odd.ranks[1]!.map((id) => odd.nodes.get(id)!)
    const x = odd.edges.find((edge) => edge.from === 'a' && edge.to === 'd')!.points[0]!.x
    expect(x < nodes[0]!.x || x > nodes[2]!.x + nodes[2]!.width).toBe(true)
    expect(nodes[1]!.x - nodes[0]!.x).toBe(nodes[2]!.x - nodes[1]!.x)
  })

  it('runs a long edge straight down the middle on the coarse grid NodeGraph uses', () => {
    // NodeGraph snaps rows to half a node pitch; the edge sits between rows
    // instead of taking a whole extra one on each side (448 wide before).
    const layout = layoutGraph(
      ['r', 'api', 'ui', 'join', 'ok'].map((id) => ({ id, width: 160, height: 32 })),
      [
        { from: 'r', to: 'api' },
        { from: 'r', to: 'ui' },
        { from: 'r', to: 'join' },
        { from: 'api', to: 'join' },
        { from: 'ui', to: 'join' },
        { from: 'join', to: 'ok' },
      ],
      { direction: 'vertical', rankGap: 56, laneGap: 24, grid: (160 + 24) / 2, equalWidth: false },
    )
    const long = layout.edges.find((e) => e.from === 'r' && e.to === 'join')!
    expect(long.path).not.toMatch(/C/)
    expect(middle(layout, 'r')).toBe(long.points[0]!.x)
    expect(middle(layout, 'join')).toBe(long.points[0]!.x)
    expect(layout.width).toBe(436)
  })

  it('keeps a long edge where it is when moving it to the middle would add crossings', () => {
    const top = [0, 1, 2, 3, 4, 5].map((i) => item(`t${i}`))
    const [v, w, long] = [item('v'), item('w'), item('long', 0)]
    const z = item('z')
    // `v` and `w` are fed from 0, 1 and 5, on average 2, like the long edge
    // from 2, but from more places left of it than right.
    for (const n of [v, w]) for (const i of [0, 1, 5]) link(top[i]!, n)
    link(top[2]!, long)
    for (const n of [v, w, long]) link(n, z)
    const layers: Layers = [top, [v, w, long], [z]]
    expect(centreLongEdges(layers)[1]!.map((n) => n.id)).toEqual(['v', 'w', 'long'])
    // Fed from 1, 2 and 3 instead, the edge has nothing to cross and goes in the middle.
    for (const n of [v, w]) {
      n.preds = [1, 2, 3].map((i) => top[i]!)
    }
    for (const t of top) t.succs = t.succs.filter((n) => n === long)
    for (const n of [v, w]) for (const p of n.preds) p.succs.push(n)
    expect(centreLongEdges(layers)[1]!.map((n) => n.id)).toEqual(['v', 'long', 'w'])
  })

  it('runs long edges on both sides of a fan, or two on one side, close past it', () => {
    const vertical = {
      direction: 'vertical',
      rankGap: 56,
      laneGap: 40,
      equalWidth: false,
      grid: 8,
    } as const
    const lay = (spec: string) => {
      const edges = spec.split(',').map((pair) => {
        const [from, to] = pair.split('>')
        return { from: from!, to: to! }
      })
      const ids = [...new Set(edges.flatMap((e) => [e.from, e.to]))]
      const layout = layoutGraph(
        ids.map((id) => ({ id, width: 272, height: 64 })),
        edges,
        vertical,
      )
      const [b, c] = layout.ranks[1]!.map((id) => layout.nodes.get(id)!)
      const a = layout.nodes.get('a')!
      expect(a.x + a.width / 2).toBe((b!.x + c!.x + c!.width) / 2)
      // How far each long edge out of `a` runs past the fan, from the nearest node.
      const past = layout.edges
        .filter((e) => e.from === 'a' && e.points.length)
        .map((e) => e.points[0]!.x)
        .map((x) => (x < b!.x ? x - b!.x : x - c!.x - c!.width))
        .toSorted((p, q) => p - q)
      return { layout, past }
    }
    // One on each side: a lane gap past either end. Mirroring the nodes made it 960 wide.
    const both = lay('a>b,a>c,a>d,a>e,b>d,b>e,c>d,c>e')
    expect(both.past).toEqual([-40, 40])
    expect(both.layout.width).toBe(672)
    // Two on one side: a lane gap past the fan, then an edge gap apart. Was 952.
    const two = lay('a>b,a>c,a>d,a>e,b>d,d>e')
    expect(two.past).toEqual([40, 48])
    expect(two.layout.width).toBe(640)
  })

  it('never lets a part joined only by a long edge drift away', () => {
    // No wider than before long edges ran close past fans, not 396 and 424.
    expect(smallGraph('a>b,a>c,a>g,d>f,f>g', true).height).toBeLessThanOrEqual(200)
    expect(smallGraph('a>b,a>c,a>g,d>e,e>g,f>g', false).height).toBeLessThanOrEqual(256)

    // A chain beside a fan's long edge stays close: 904 wide before, not 1352.
    const layout = layoutGraph(
      [
        { id: 'n0', width: 272, height: 40 },
        { id: 'n1', width: 272, height: 40 },
        { id: 'n2', width: 160, height: 40 },
        { id: 'n3', width: 160, height: 40 },
        { id: 'n4', width: 272, height: 32 },
        { id: 'n5', width: 120, height: 40 },
        { id: 'n6', width: 160, height: 64 },
      ],
      [
        { from: 'n0', to: 'n5' },
        { from: 'n1', to: 'n4' },
        { from: 'n1', to: 'n6' },
        { from: 'n2', to: 'n6' },
        { from: 'n3', to: 'n5' },
        { from: 'n5', to: 'n6' },
      ],
      {
        direction: 'vertical',
        rankGap: 56,
        laneGap: 40,
        equalWidth: false,
        grid: 8,
        straightChains: true,
      },
    )
    expect(layout.width).toBeLessThanOrEqual(904)

    // Leaving long edges out of the fans lets this one settle 1204 wide; laid
    // out keeping them in, as before, it is 964, and the narrower wins.
    const drifting = layoutGraph(
      [
        { id: 'n0', width: 120, height: 64 },
        { id: 'n1', width: 160, height: 40 },
        { id: 'n2', width: 272, height: 64 },
        { id: 'n3', width: 160, height: 40 },
        { id: 'n4', width: 120, height: 32 },
        { id: 'n6', width: 272, height: 40 },
        { id: 'n7', width: 120, height: 40 },
        { id: 'n8', width: 120, height: 32 },
      ],
      [
        { from: 'n0', to: 'n2' },
        { from: 'n0', to: 'n3' },
        { from: 'n1', to: 'n6' },
        { from: 'n1', to: 'n7' },
        { from: 'n2', to: 'n4' },
        { from: 'n2', to: 'n8' },
        { from: 'n3', to: 'n8' },
        { from: 'n4', to: 'n8' },
        { from: 'n6', to: 'n8' },
      ],
      {
        direction: 'vertical',
        rankGap: 56,
        laneGap: 40,
        equalWidth: false,
        grid: 8,
        straightChains: true,
      },
    )
    expect(drifting.width).toBeLessThanOrEqual(964)
  })

  it('widens only the gaps beside a long node, mirrored', () => {
    const { layout, gaps, xs, parent } = fan([98, 98, 98, 320, 98, 98])
    expect(gaps).toEqual(gaps.toReversed())
    expect(parent).toBe((xs[0]! + xs.at(-1)!) / 2)
    // two short nodes stay a short pitch apart: 98 + 20 rounded up to six grid steps
    expect(Math.min(...gaps)).toBe(156)
    const packed = 5 * 98 + 320 + 5 * 20
    expect(layout.width).toBeLessThan(packed * 1.5)
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

  it('moves a node that feeds more than it is fed down to where it is needed', () => {
    const edges = [
      { from: 's', to: 'm' },
      { from: 'm', to: 't' },
      { from: 'm', to: 'u' },
      { from: 's', to: 'p' },
      { from: 'p', to: 'q' },
      { from: 'q', to: 't' },
      { from: 'q', to: 'u' },
    ]
    const { order, edges: kept } = acyclic(['s', 'm', 'p', 'q', 't', 'u'], edges)
    expect(rank(order, kept).get('m')).toBe(2)
  })

  it('lays parts that are not joined out side by side, the largest first', () => {
    const layout = layoutGraph(
      [size('x'), size('a'), size('y'), size('b'), size('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'x', to: 'y' },
      ],
      options,
    )
    const top = (id: string) => layout.nodes.get(id)!.y
    const bottom = (id: string) => top(id) + layout.nodes.get(id)!.height
    // The chain a → b → c comes first; x → y below it, never between.
    expect(top('x')).toBeGreaterThanOrEqual(bottom('a') + options.laneGap * 2)
    expect(top('y')).toBe(top('x'))
    expect(layout.ranks[0]).toEqual(['a', 'x'])
  })

  it('gives the points a long edge runs through', () => {
    const layout = layoutGraph(
      [size('a'), size('b'), size('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'a', to: 'c' },
      ],
      { ...options, direction: 'vertical' },
    )
    const long = layout.edges.find((e) => e.from === 'a' && e.to === 'c')!
    const b = layout.nodes.get('b')!
    expect(long.points).toHaveLength(2)
    expect(long.points[0]!.y).toBe(b.y)
    expect(long.points[1]!.y).toBe(b.y + b.height)
    expect(long.points[0]!.x).toBe(long.points[1]!.x)
    expect(layout.edges.find((e) => e.to === 'b')!.points).toEqual([])
  })

  it('keeps chains straight with straightChains, long edges bending around them', () => {
    const centre = (layout: ReturnType<typeof chainWithLongEdge>, id: string) => {
      const n = layout.nodes.get(id)!
      return n.x + n.width / 2
    }
    const straight = chainWithLongEdge(true)
    expect(centre(straight, 'a')).toBe(centre(straight, 'b'))
    expect(centre(straight, 'c')).toBe(centre(straight, 'b'))
    // Off, the ends sit between the chain and the long edge.
    const centred = chainWithLongEdge(false)
    expect(centre(centred, 'c')).not.toBe(centre(centred, 'b'))
  })

  it('handles an empty graph', () => {
    const layout = layoutGraph([], [], options)
    expect(layout.width).toBe(0)
    expect(layout.height).toBe(0)
  })
})
