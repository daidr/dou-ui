import { describe, expect, it, vi } from 'vitest'
import { canJoin, displacedEdges, joinRefusal, reaches, typesMatch } from '../core/connect'
import { flowOrder } from '../core/order'
import { bezierPath } from '../core/edge-types'
import { intersectsTurned, snapBox, turnedBox } from '../core/geometry'
import { defineNodeType, nodeBounds, resizeOf } from '../core/node-types'
import { FlowHistory } from '../core/history'
import type { FlowDocument } from '../core/model'
import { applyFlowSteps, compactFlowSteps, FlowTransaction } from '../core/transaction'

const doc = (): FlowDocument => ({
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: 'A' } },
    { id: 'b', x: 200, y: 0, data: { label: 'B' } },
  ],
  edges: [{ id: 'e', source: { node: 'a' }, target: { node: 'b' } }],
})

describe('FlowTransaction', () => {
  it('applies steps without touching the original document', () => {
    const before = doc()
    const tr = new FlowTransaction(before).moveNode('a', 10, 20).updateData('b', { label: 'B2' })
    expect(tr.doc.nodes[0]).toMatchObject({ x: 10, y: 20 })
    expect(tr.doc.nodes[1]!.data).toEqual({ label: 'B2' })
    expect(before.nodes[0]).toMatchObject({ x: 0, y: 0 })
    expect(tr.doc.edges).toBe(before.edges)
  })

  it('removes the edges of a removed node', () => {
    const tr = new FlowTransaction(doc()).removeNode('a')
    expect(tr.doc.nodes.map((n) => n.id)).toEqual(['b'])
    expect(tr.doc.edges).toEqual([])
  })

  it('inverts to the original document', () => {
    const before = doc()
    const tr = new FlowTransaction(before)
      .removeNode('a')
      .addNode({ id: 'c', x: 5, y: 5 })
      .updateNode('b', { width: 120 })
    expect(applyFlowSteps(tr.doc, tr.inverse).doc).toEqual(before)
  })

  it('skips steps that change nothing', () => {
    const tr = new FlowTransaction(doc()).moveNode('a', 0, 0).removeNode('missing')
    expect(tr.changed).toBe(false)
    expect(tr.doc).toBe(tr.before)
  })

  it('removes a key when patched with undefined', () => {
    const tr = new FlowTransaction(doc()).updateNode('a', { width: 100 })
    const back = new FlowTransaction(tr.doc).updateNode('a', { width: undefined })
    expect('width' in back.doc.nodes[0]!).toBe(false)
  })
})

describe('compactFlowSteps', () => {
  it('folds updates of the same target', () => {
    const steps = compactFlowSteps([
      { type: 'updateNode', id: 'a', patch: { x: 1 } },
      { type: 'updateNode', id: 'b', patch: { x: 1 } },
      { type: 'updateNode', id: 'a', patch: { x: 2, y: 3 } },
    ])
    expect(steps).toEqual([
      { type: 'updateNode', id: 'a', patch: { x: 2, y: 3 } },
      { type: 'updateNode', id: 'b', patch: { x: 1 } },
    ])
  })

  it('keeps updates apart across a removal', () => {
    const steps = compactFlowSteps([
      { type: 'updateNode', id: 'a', patch: { x: 1 } },
      { type: 'removeNode', id: 'a' },
      { type: 'updateNode', id: 'a', patch: { x: 2 } },
    ])
    expect(steps).toHaveLength(3)
  })
})

describe('FlowHistory', () => {
  const none = { nodes: [], edges: [] }

  it('undoes and redoes', () => {
    const history = new FlowHistory()
    const tr = new FlowTransaction(doc()).moveNode('a', 50, 50)
    history.record(tr, none, { nodes: ['a'], edges: [] })
    const undone = history.undo(tr.doc)!
    expect(undone.tr.doc.nodes[0]).toMatchObject({ x: 0, y: 0 })
    expect(undone.selection).toEqual(none)
    const redone = history.redo(undone.tr.doc)!
    expect(redone.tr.doc.nodes[0]).toMatchObject({ x: 50, y: 50 })
    expect(redone.selection).toEqual({ nodes: ['a'], edges: [] })
  })

  it('merges a group into one step', () => {
    const history = new FlowHistory()
    let current = doc()
    for (let i = 1; i <= 5; i++) {
      const tr = new FlowTransaction(current).setMeta({ group: 'drag' }).moveNode('a', i * 10, 0)
      history.record(tr, none, none, 1000 + i)
      current = tr.doc
    }
    const undone = history.undo(current)!
    expect(undone.tr.doc.nodes[0]).toMatchObject({ x: 0, y: 0 })
    expect(history.canUndo).toBe(false)
  })

  it('starts a new step after close() or a pause', () => {
    const history = new FlowHistory()
    let current = doc()
    const move = (x: number, now: number) => {
      const tr = new FlowTransaction(current).setMeta({ group: 'nudge' }).moveNode('a', x, 0)
      history.record(tr, none, none, now)
      current = tr.doc
    }
    move(8, 0)
    history.close()
    move(16, 10)
    move(24, 5000)
    current = history.undo(current)!.tr.doc
    expect(current.nodes[0]!.x).toBe(16)
    current = history.undo(current)!.tr.doc
    expect(current.nodes[0]!.x).toBe(8)
  })

  it('keeps changes marked history: false out', () => {
    const history = new FlowHistory()
    history.record(
      new FlowTransaction(doc()).setMeta({ history: false }).moveNode('a', 1, 1),
      none,
      none,
    )
    expect(history.canUndo).toBe(false)
  })
})

describe('snapBox', () => {
  const box = { x: 103, y: 47, width: 100, height: 40 }

  it('lines up with a nearby edge or centre', () => {
    const other = { x: 100, y: 200, width: 120, height: 40 }
    const result = snapBox(box, [other], { threshold: 6, grid: 8 })
    expect(result.dx).toBe(-3)
    expect(result.guides).toEqual([{ axis: 'x', at: 100, from: 48, to: 240 }])
    // No match on y: the top snaps to the grid.
    expect(result.dy).toBe(1)
  })

  it('snaps to the grid without neighbours', () => {
    expect(snapBox(box, [], { threshold: 6, grid: 8 })).toEqual({ dx: 1, dy: 1, guides: [] })
  })
})

describe('bezierPath', () => {
  it('is a straight line between level ports', () => {
    expect(bezierPath({ x: 0, y: 10 }, 'right', { x: 100, y: 10 }, 'left')).toBe(
      'M0 10C50 10 50 10 100 10',
    )
  })

  it('mirrors two edges fanning out of one port', () => {
    const up = bezierPath({ x: 0, y: 0 }, 'right', { x: 120, y: -40 }, 'left')
    const down = bezierPath({ x: 0, y: 0 }, 'right', { x: 120, y: 40 }, 'left')
    expect(up).toBe('M0 0C60 0 60 -40 120 -40')
    expect(down).toBe('M0 0C60 0 60 40 120 40')
  })

  it('keeps a minimum handle for short or backward edges', () => {
    expect(bezierPath({ x: 100, y: 0 }, 'right', { x: 0, y: 80 }, 'left')).toBe(
      'M100 0C150 0 -50 80 0 80',
    )
  })
})

const graph = (): FlowDocument => ({
  nodes: [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 200, y: 0 },
    { id: 'c', x: 400, y: 0 },
  ],
  edges: [{ id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
})
const out = { id: 'out', kind: 'output' } as const
const inp = { id: 'in', kind: 'input' } as const
const join = (source: string, target: string) => ({
  source: { node: source, port: 'out' },
  target: { node: target, port: 'in' },
})

describe('connection rules', () => {
  it('matches types in layers', () => {
    expect(typesMatch(out, inp)).toBe(true)
    expect(typesMatch({ ...out, dataType: 'number' }, inp)).toBe(true)
    expect(typesMatch({ ...out, dataType: 'number' }, { ...inp, dataType: 'text' })).toBe(false)
    expect(typesMatch({ ...out, dataType: 'number' }, { ...inp, dataType: 'any' })).toBe(true)
    expect(
      typesMatch({ ...out, dataType: 'number' }, { ...inp, dataType: ['text', 'number'] }),
    ).toBe(true)
    const portTypes = { text: { accepts: ['number'] } }
    expect(
      typesMatch({ ...out, dataType: 'number' }, { ...inp, dataType: 'text' }, portTypes),
    ).toBe(true)
    expect(
      typesMatch({ ...out, dataType: 'text' }, { ...inp, dataType: 'number' }, portTypes),
    ).toBe(false)
  })

  it('follows edges to find reachable nodes', () => {
    expect(reaches(graph(), 'a', 'b')).toBe(true)
    expect(reaches(graph(), 'b', 'a')).toBe(false)
  })

  it('says why a connection is refused', () => {
    const ports = { source: out, target: inp }
    expect(joinRefusal(graph(), join('b', 'c'), ports)).toBeNull()
    expect(joinRefusal(graph(), join('b', 'c'), { source: inp, target: out })).toEqual({
      reason: 'direction',
    })
    expect(joinRefusal(graph(), join('a', 'a'), ports)).toEqual({ reason: 'self' })
    expect(joinRefusal(graph(), join('a', 'b'), ports)).toEqual({ reason: 'duplicate' })
    expect(
      joinRefusal(graph(), join('b', 'c'), {
        source: { ...out, dataType: 'a' },
        target: { ...inp, dataType: 'b' },
      }),
    ).toEqual({ reason: 'type' })
    expect(joinRefusal(graph(), join('b', 'a'), ports, { acyclic: true })).toEqual({
      reason: 'cycle',
    })
    expect(canJoin(graph(), join('b', 'a'), ports)).toBe(true)
    expect(joinRefusal(graph(), join('b', 'c'), ports, { canConnect: () => false })).toEqual({
      reason: 'custom',
      message: undefined,
    })
    expect(joinRefusal(graph(), join('b', 'c'), ports, { canConnect: () => '只能连一次' })).toEqual(
      {
        reason: 'custom',
        message: '只能连一次',
      },
    )
    // A full port still takes the edge.
    expect(canJoin(graph(), join('c', 'b'), ports)).toBe(true)
  })

  it('makes room on full ports by dropping their oldest edges', () => {
    const ports = { source: out, target: inp }
    expect(displacedEdges(graph(), join('c', 'b'), ports)).toEqual(['e1'])
    expect(
      displacedEdges(graph(), join('c', 'b'), { source: out, target: { ...inp, max: 2 } }),
    ).toEqual([])
    const full = { ...graph(), edges: [...graph().edges, { id: 'e2', ...join('c', 'b') }] }
    expect(
      displacedEdges(full, join('a', 'b'), { source: out, target: { ...inp, max: 2 } }),
    ).toEqual(['e1'])
    expect(
      displacedEdges(graph(), join('a', 'c'), { source: { ...out, max: 1 }, target: inp }),
    ).toEqual(['e1'])
    // The edge being moved doesn't count.
    expect(
      displacedEdges(graph(), join('a', 'c'), { source: { ...out, max: 1 }, target: inp }, 'e1'),
    ).toEqual([])
  })
})

describe('flowOrder', () => {
  it('follows the edges, then goes left to right', () => {
    const order = flowOrder({
      nodes: [
        { id: 'tool', x: 300, y: -100 },
        { id: 'start', x: 0, y: 100 },
        { id: 'reply', x: 600, y: 0 },
        { id: 'note', x: 100, y: 400 },
      ],
      edges: [
        { id: '1', source: { node: 'start' }, target: { node: 'tool' } },
        { id: '2', source: { node: 'tool' }, target: { node: 'reply' } },
      ],
    })
    expect(order.map((n) => n.id)).toEqual(['start', 'note', 'tool', 'reply'])
  })

  it('puts nodes on a cycle last', () => {
    const order = flowOrder({
      nodes: [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 200, y: 0 },
        { id: 'c', x: 400, y: 0 },
      ],
      edges: [
        { id: '1', source: { node: 'b' }, target: { node: 'c' } },
        { id: '2', source: { node: 'c' }, target: { node: 'b' } },
      ],
    })
    expect(order.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('turned nodes', () => {
  const rect = { x: 0, y: 0, width: 200, height: 20 }

  it('takes the box around a turned rectangle', () => {
    const box = turnedBox(rect, 90)
    expect(box.x).toBeCloseTo(90)
    expect(box.y).toBeCloseTo(-90)
    expect(box.width).toBeCloseTo(20)
    expect(box.height).toBeCloseTo(200)
    expect(turnedBox(rect, 0)).toBe(rect)
  })

  it('tells whether a box meets a turned rectangle', () => {
    // inside the upright box, outside the turned one
    expect(intersectsTurned({ x: 2, y: 2, width: 38, height: 16 }, rect, 90)).toBe(false)
    expect(intersectsTurned({ x: 95, y: 60, width: 10, height: 20 }, rect, 90)).toBe(true)
    // inside the box around it at 45°, but off its sides
    expect(intersectsTurned({ x: 10, y: -60, width: 10, height: 10 }, rect, 45)).toBe(false)
    expect(intersectsTurned({ x: 95, y: 5, width: 10, height: 10 }, rect, 45)).toBe(true)
  })

  it('bounds a turned node, and leaves its resizing to it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spec = defineNodeType<{ turn?: number }>({
      type: 'turned',
      component: {},
      frame: false,
      resizable: true,
      rotation: (node) => node.data?.turn ?? 0,
    })
    expect(warn).not.toHaveBeenCalled()
    const node = { id: 'n', type: 'turned', x: 0, y: 0, data: { turn: 90 } }
    expect(nodeBounds(spec, node, rect).height).toBeCloseTo(200)
    expect(resizeOf(spec, node)).toBeNull()
    expect(resizeOf(spec, { ...node, data: {} })).toEqual({})
    // a card the editor draws doesn't turn
    defineNodeType({ type: 'card', component: {}, rotation: () => 10 })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"card" has rotation but not frame: false'),
    )
    warn.mockRestore()
  })
})
