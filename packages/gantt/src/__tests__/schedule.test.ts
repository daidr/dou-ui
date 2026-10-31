import { describe, expect, it } from 'vitest'
import type { GanttLink, GanttTask } from '../core/model'
import { computeCriticalPath, computeSchedule, findBrokenLinks } from '../core/schedule'

// 2026-03-02 is a Monday
const doc = (tasks: GanttTask[], links: GanttLink[]) => ({ tasks, links })

describe('schedule', () => {
  it('pushes a follower past the end of what it waits for, keeping its working days', () => {
    const result = computeSchedule(
      doc(
        [
          { id: 'a', title: 'A', start: '2026-03-02', end: '2026-03-05' },
          { id: 'b', title: 'B', start: '2026-03-04', end: '2026-03-05' },
          { id: 'c', title: 'C', start: '2026-03-20', end: '2026-03-20' },
        ],
        [
          { id: 'ab', from: 'a', to: 'b' },
          { id: 'bc', from: 'b', to: 'c' },
        ],
      ),
    )
    // two working days from Friday: Friday and Monday
    expect(result.moves.get('b')).toEqual({ start: '2026-03-06', end: '2026-03-09' })
    // c is already late enough
    expect(result.moves.has('c')).toBe(false)
    expect(result.violated.size).toBe(0)
  })

  it('treats Friday to Monday as back to back, and pulls only when asked', () => {
    const tasks: GanttTask[] = [
      { id: 'a', title: 'A', start: '2026-03-02', end: '2026-03-06' },
      { id: 'b', title: 'B', start: '2026-03-09', end: '2026-03-10' },
      { id: 'c', title: 'C', start: '2026-03-16', end: '2026-03-16' },
    ]
    const links: GanttLink[] = [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
    ]
    expect(computeSchedule(doc(tasks, links)).moves.size).toBe(0)
    expect(computeSchedule(doc(tasks, links), { pull: true }).moves.get('c')).toEqual({
      start: '2026-03-11',
      end: '2026-03-11',
    })
  })

  it('reads lag, link types and the calendar', () => {
    const tasks: GanttTask[] = [
      { id: 'a', title: 'A', start: '2026-03-02', end: '2026-03-03' },
      { id: 'b', title: 'B', start: '2026-03-02', end: '2026-03-02' },
      { id: 'c', title: 'C', start: '2026-03-02', end: '2026-03-02' },
    ]
    const result = computeSchedule(
      doc(tasks, [
        { id: 'ab', from: 'a', to: 'b', lag: 2 },
        { id: 'ac', from: 'a', to: 'c', type: 'ff' },
      ]),
      { calendar: { holidays: ['2026-03-05'] } },
    )
    // after Tuesday, skip Wednesday and the Thursday holiday... two working days of lag
    expect(result.moves.get('b')).toEqual({ start: '2026-03-09', end: '2026-03-09' })
    // finish together: c ends on Tuesday
    expect(result.moves.get('c')).toEqual({ start: '2026-03-03', end: '2026-03-03' })
  })

  it('works in working minutes for timed tasks', () => {
    const result = computeSchedule(
      doc(
        [
          { id: 'a', title: 'A', start: '2026-03-02 14:00', end: '2026-03-02 17:00' },
          { id: 'b', title: 'B', start: '2026-03-02 09:00', end: '2026-03-02 12:00' },
        ],
        [{ id: 'ab', from: 'a', to: 'b' }],
      ),
    )
    // 17:00, then three working hours: one today, two tomorrow
    expect(result.moves.get('b')).toEqual({ start: '2026-03-02 17:00', end: '2026-03-03 11:00' })
  })

  it('leaves locked and fixed tasks, and reports the links they break', () => {
    const tasks: GanttTask[] = [
      { id: 'a', title: 'A', start: '2026-03-02', end: '2026-03-06' },
      { id: 'b', title: 'B', start: '2026-03-03', end: '2026-03-03', locked: true },
      { id: 'c', title: 'C', start: '2026-03-03', end: '2026-03-03' },
    ]
    const links: GanttLink[] = [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'ac', from: 'a', to: 'c' },
    ]
    const result = computeSchedule(doc(tasks, links), { fixed: ['c'] })
    expect(result.moves.size).toBe(0)
    expect([...result.violated]).toEqual(['ab', 'ac'])
    expect(findBrokenLinks(doc(tasks, links))).toEqual(new Set(['ab', 'ac']))
  })

  it('applies a link to a summary to each subtask, and reads one from a summary as a whole', () => {
    const result = computeSchedule(
      doc(
        [
          { id: 'p', title: 'P' },
          { id: 'p1', title: 'P1', parent: 'p', start: '2026-03-02', end: '2026-03-02' },
          { id: 'p2', title: 'P2', parent: 'p', start: '2026-03-02', end: '2026-03-04' },
          { id: 'q', title: 'Q' },
          { id: 'q1', title: 'Q1', parent: 'q', start: '2026-03-02', end: '2026-03-02' },
          { id: 'q2', title: 'Q2', parent: 'q', start: '2026-03-03', end: '2026-03-03' },
        ],
        [{ id: 'pq', from: 'p', to: 'q' }],
      ),
    )
    expect(result.moves.get('q1')).toEqual({ start: '2026-03-05', end: '2026-03-05' })
    expect(result.moves.get('q2')).toEqual({ start: '2026-03-05', end: '2026-03-05' })
  })

  it('places a milestone at the end of the day its predecessor finishes', () => {
    const result = computeSchedule(
      doc(
        [
          { id: 'a', title: 'A', start: '2026-03-02', end: '2026-03-06' },
          { id: 'm', title: 'M', type: 'milestone', start: '2026-03-02' },
          { id: 'b', title: 'B', start: '2026-03-02', end: '2026-03-02' },
        ],
        [
          { id: 'am', from: 'a', to: 'm' },
          { id: 'mb', from: 'm', to: 'b' },
        ],
      ),
    )
    expect(result.moves.get('m')).toEqual({ start: '2026-03-06' })
    expect(result.moves.get('b')).toEqual({ start: '2026-03-09', end: '2026-03-09' })
  })

  it('leaves a loop alone and names its tasks', () => {
    const result = computeSchedule(
      doc(
        [
          { id: 'a', title: 'A', start: '2026-03-02' },
          { id: 'b', title: 'B', start: '2026-03-02' },
        ],
        [
          { id: 'ab', from: 'a', to: 'b' },
          { id: 'ba', from: 'b', to: 'a' },
        ],
      ),
    )
    expect(result.moves.size).toBe(0)
    expect(new Set(result.cycle)).toEqual(new Set(['a', 'b']))
  })
})

describe('criticalPath', () => {
  it('finds the chain with no slack', () => {
    const path = computeCriticalPath(
      doc(
        [
          { id: 'a', title: 'A', start: '2026-03-02', end: '2026-03-03' },
          { id: 'b', title: 'B', start: '2026-03-04', end: '2026-03-06' },
          { id: 'c', title: 'C', start: '2026-03-04', end: '2026-03-04' },
          { id: 'd', title: 'D', start: '2026-03-06', type: 'milestone' },
        ],
        [
          { id: 'ab', from: 'a', to: 'b' },
          { id: 'ac', from: 'a', to: 'c' },
          { id: 'bd', from: 'b', to: 'd' },
          { id: 'cd', from: 'c', to: 'd' },
        ],
      ),
    )
    expect(path.tasks).toEqual(new Set(['a', 'b', 'd']))
    expect(path.links).toEqual(new Set(['ab', 'bd']))
  })
})
