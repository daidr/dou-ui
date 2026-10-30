import { describe, expect, it } from 'vitest'
import { GanttHistory } from '../core/history'
import { parseTime } from '../core/time'
import { applySteps, compactSteps, GanttTransaction, type GanttDocument } from '../core/transaction'

const doc = (): GanttDocument => ({
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
  })

  it('removes a task with its subtasks and links, and undoes it all', () => {
    const before = doc()
    const tr = new GanttTransaction(before)
    tr.removeTask('p')
    expect(tr.doc.tasks.map((t) => t.id)).toEqual(['b'])
    expect(tr.doc.links).toEqual([])
    expect(tr.touches('links')).toBe(true)
    const undone = applySteps(tr.doc, tr.inverse).doc
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
