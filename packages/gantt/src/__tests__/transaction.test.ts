import { describe, expect, it } from 'vitest'
import { GanttHistory } from '../core/history'
import type { GanttTask } from '../core/model'
import { parseTime } from '../core/time'
import { buildTree } from '../core/tree'
import {
  applyGanttSteps,
  compactSteps,
  GanttTransaction,
  type GanttDocument,
} from '../core/transaction'

const doc = (): GanttDocument => ({
  version: 1,
  tasks: [
    { id: 'p', title: '发布' },
    { id: 'a', parent: 'p', title: '设计', start: '2026-03-02', end: '2026-03-06' },
    { id: 'b', title: '开发', start: '2026-03-09 09:00', end: '2026-03-09 18:00' },
  ],
  links: [{ id: 'l', from: 'a', to: 'b' }],
})

const at = (text: string) => parseTime(text)!.at

describe('GanttTransaction', () => {
  it('writes spans in the task’s own style', () => {
    const tr = new GanttTransaction(doc())
    // a date-only end is the day it ends on
    tr.setSpan('a', at('2026-03-03'), at('2026-03-08'))
    tr.setSpan('b', at('2026-03-09 10:00'), at('2026-03-09 12:00'))
    expect(tr.getTask('a')).toMatchObject({ start: '2026-03-03', end: '2026-03-07' })
    expect(tr.getTask('b')).toMatchObject({ start: '2026-03-09 10:00', end: '2026-03-09 12:00' })
    // strings are read like task dates: a date-only end is the last day
    tr.setSpan('a', '2026-03-10', '2026-03-12')
    expect(tr.getTask('a')).toMatchObject({ start: '2026-03-10', end: '2026-03-12' })
    expect(() => tr.setSpan('a', '3/10', '3/12')).toThrow(RangeError)
  })

  it('removes a task with its subtasks and links, and undoes it all', () => {
    const before = doc()
    const tr = new GanttTransaction(before)
    tr.removeTask('p')
    expect(tr.doc.tasks.map((t) => t.id)).toEqual(['b'])
    expect(tr.doc.links).toEqual([])
    expect(tr.touches('links')).toBe(true)
    const undone = applyGanttSteps(tr.doc, tr.inverse).doc
    expect(undone).toEqual(before)
  })

  it('skips steps that change nothing', () => {
    const tr = new GanttTransaction(doc())
    tr.updateTask('a', { title: '设计' }).removeLink('nope')
    expect(tr.changed).toBe(false)
    expect(tr.doc).toBe(tr.before)
  })

  it('folds updates of one task', () => {
    const steps = compactSteps([
      { type: 'updateTask', id: 'a', patch: { start: '2026-03-03' } },
      { type: 'updateTask', id: 'b', patch: { progress: 0.5 } },
      { type: 'updateTask', id: 'a', patch: { end: '2026-03-07' } },
    ])
    expect(steps).toHaveLength(2)
    expect(steps[0]).toEqual({
      type: 'updateTask',
      id: 'a',
      patch: { start: '2026-03-03', end: '2026-03-07' },
    })
  })
})

describe('GanttHistory', () => {
  it('undoes and redoes, merging a group', () => {
    const history = new GanttHistory()
    let current = doc()
    const run = (fn: (tr: GanttTransaction) => void, group?: string, now = 0) => {
      const tr = new GanttTransaction(current).setMeta({ group })
      fn(tr)
      current = tr.doc
      history.record(tr, [], ['a'], now)
    }
    run((tr) => tr.updateTask('a', { progress: 0.1 }), 'nudge', 0)
    run((tr) => tr.updateTask('a', { progress: 0.2 }), 'nudge', 500)
    run((tr) => tr.updateTask('b', { title: '开发 API' }))
    let step = history.undo(current)!
    current = step.tr.doc
    expect(current.tasks[2]!.title).toBe('开发')
    step = history.undo(current)!
    current = step.tr.doc
    expect(current.tasks[1]!.progress).toBeUndefined()
    expect(history.canUndo).toBe(false)
    current = history.redo(current)!.tr.doc
    expect(current.tasks[1]!.progress).toBe(0.2)
  })
})

const nested = (): GanttTask[] => [
  { id: 'p', title: 'P' },
  { id: 'a', title: 'A', parent: 'p' },
  { id: 'b', title: 'B', parent: 'p' },
  { id: 'c', title: 'C' },
]
const childOrder = (state: GanttDocument, parent?: string) =>
  buildTree(state.tasks)
    .childrenOf.get(parent)
    ?.map((task) => task.id)

describe('moveTask', () => {
  it('moves among siblings, giving keys to siblings that had none', () => {
    const tr = new GanttTransaction({ version: 1, tasks: nested(), links: [] }).moveTask(
      'b',
      'p',
      0,
    )
    expect(childOrder(tr.doc, 'p')).toEqual(['b', 'a'])
    // now they have keys: the next move only rewrites one task
    const next = new GanttTransaction(tr.doc).moveTask('a', 'p', 0)
    expect(next.steps).toHaveLength(1)
    expect(childOrder(next.doc, 'p')).toEqual(['a', 'b'])
  })

  it('moves under another parent and out to the top', () => {
    let state: GanttDocument = { version: 1, tasks: nested(), links: [] }
    state = new GanttTransaction(state).moveTask('c', 'a').doc
    expect(childOrder(state, 'a')).toEqual(['c'])
    state = new GanttTransaction(state).moveTask('a', undefined, 1).doc
    expect(childOrder(state)).toEqual(['p', 'a'])
    expect(state.tasks.find((task) => task.id === 'a')!.parent).toBeUndefined()
  })

  it('refuses a move into itself and drops links to the new parents', () => {
    const state: GanttDocument = {
      version: 1,
      tasks: nested(),
      links: [
        { id: 'l1', from: 'c', to: 'a' },
        { id: 'l2', from: 'b', to: 'c' },
      ],
    }
    expect(new GanttTransaction(state).moveTask('p', 'a').changed).toBe(false)
    const tr = new GanttTransaction(state).moveTask('c', 'a')
    expect(tr.doc.links.map((link) => link.id)).toEqual(['l2'])
  })
})
