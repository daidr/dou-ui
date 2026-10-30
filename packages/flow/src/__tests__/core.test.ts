import { describe, expect, it } from 'vitest'
import { bezierPath, snapBox } from '../core/geometry'
import { FlowHistory } from '../core/history'
import type { FlowDocument } from '../core/model'
import { applySteps, compactSteps, Transaction } from '../core/transaction'

const doc = (): FlowDocument => ({
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: 'A' } },
    { id: 'b', x: 200, y: 0, data: { label: 'B' } },
  ],
  edges: [{ id: 'e', source: { node: 'a' }, target: { node: 'b' } }],
})

describe('Transaction', () => {
  it('applies steps without touching the original document', () => {
    const before = doc()
    const tr = new Transaction(before).moveNode('a', 10, 20).updateData('b', { label: 'B2' })
    expect(tr.doc.nodes[0]).toMatchObject({ x: 10, y: 20 })
    expect(tr.doc.nodes[1]!.data).toEqual({ label: 'B2' })
    expect(before.nodes[0]).toMatchObject({ x: 0, y: 0 })
    expect(tr.doc.edges).toBe(before.edges)
  })

  it('removes the edges of a removed node', () => {
    const tr = new Transaction(doc()).removeNode('a')
    expect(tr.doc.nodes.map((n) => n.id)).toEqual(['b'])
    expect(tr.doc.edges).toEqual([])
  })

  it('inverts to the original document', () => {
    const before = doc()
    const tr = new Transaction(before)
      .removeNode('a')
      .addNode({ id: 'c', x: 5, y: 5 })
      .updateNode('b', { width: 120 })
    expect(applySteps(tr.doc, tr.inverse).doc).toEqual(before)
  })

  it('skips steps that change nothing', () => {
    const tr = new Transaction(doc()).moveNode('a', 0, 0).removeNode('missing')
    expect(tr.changed).toBe(false)
    expect(tr.doc).toBe(tr.before)
  })

  it('removes a key when patched with undefined', () => {
    const tr = new Transaction(doc()).updateNode('a', { width: 100 })
    const back = new Transaction(tr.doc).updateNode('a', { width: undefined })
    expect('width' in back.doc.nodes[0]!).toBe(false)
  })
})

describe('compactSteps', () => {
  it('folds updates of the same target', () => {
    const steps = compactSteps([
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
    const steps = compactSteps([
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
    const tr = new Transaction(doc()).moveNode('a', 50, 50)
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
      const tr = new Transaction(current).setMeta({ group: 'drag' }).moveNode('a', i * 10, 0)
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
      const tr = new Transaction(current).setMeta({ group: 'nudge' }).moveNode('a', x, 0)
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
      new Transaction(doc()).setMeta({ history: false }).moveNode('a', 1, 1),
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
