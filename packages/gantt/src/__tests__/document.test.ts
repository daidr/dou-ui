import { describe, expect, it } from 'vitest'
import { checkDocument, migrateDocument } from '../index'
import type { GanttDocument } from '../index'

const doc = (): GanttDocument => ({
  version: 1,
  tasks: [
    { id: 'p', title: '上线' },
    { id: 'a', parent: 'p', title: '设计', start: '2026-03-02', end: '2026-03-04' },
    { id: 'b', parent: 'p', title: '开发', start: '2026-03-05 09:00', end: '2026-03-06 18:00' },
    { id: 'm', title: '发布', type: 'milestone', start: '2026-03-09' },
  ],
  links: [
    { id: 'l1', from: 'a', to: 'b', lag: '4h' },
    { id: 'l2', from: 'b', to: 'm', type: 'ff' },
  ],
})

describe('checkDocument', () => {
  it('finds nothing in a good document', () => {
    expect(checkDocument(doc())).toEqual([])
  })

  it('finds the version, ids, parents and dates', () => {
    const value = doc() as unknown as { version: number; tasks: Record<string, unknown>[] }
    value.version = 2
    value.tasks.push(
      { id: 'a', title: '重复' },
      { id: '', title: '没有 id' },
      { id: 'x', title: '甲', parent: 'y', start: '下周一' },
      { id: 'y', title: '乙', parent: 'x' },
      { id: 'z', title: '丙', parent: 'nowhere', end: '2026-13-01' },
    )
    expect(
      checkDocument(value as unknown as GanttDocument).map((p) => [p.code, p.path, p.text]),
    ).toEqual([
      ['version', 'version', '2'],
      ['duplicate-id', 'tasks[4]', 'a'],
      ['missing-id', 'tasks[5]', ''],
      ['bad-date', 'tasks[6].start', '下周一'],
      ['bad-date', 'tasks[8].end', '2026-13-01'],
      ['parent-cycle', 'tasks[6].parent', 'y'],
      ['parent-cycle', 'tasks[7].parent', 'x'],
      ['missing-parent', 'tasks[8].parent', 'nowhere'],
    ])
  })

  it('finds links that point nowhere, to themselves, inside a summary, twice or in a circle', () => {
    const value = doc()
    value.links.push(
      { id: 'l1', from: 'a', to: 'gone' },
      { id: 'l3', from: 'm', to: 'm' },
      { id: 'l4', from: 'p', to: 'a' },
      { id: 'l5', from: 'b', to: 'a' },
      { id: 'l6', from: 'm', to: 'a', lag: 'soon' },
    )
    const problems = checkDocument(value)
    expect(problems.map((p) => [p.code, p.path])).toEqual([
      ['duplicate-id', 'links[2]'],
      ['missing-task', 'links[2].to'],
      ['self-link', 'links[3]'],
      ['nested-link', 'links[4]'],
      ['duplicate-link', 'links[5]'],
      ['bad-lag', 'links[6].lag'],
      ['link-cycle', 'links[6]'],
    ])
    expect(problems[1]).toMatchObject({ linkId: 'l1', taskId: 'gone' })
  })
})

describe('migrateDocument', () => {
  it('fills what is missing and keeps the rest', () => {
    expect(migrateDocument({ tasks: [{ id: 'a', title: '设计' }, 'x'], name: '计划' })).toEqual({
      version: 1,
      tasks: [{ id: 'a', title: '设计' }],
      links: [],
      name: '计划',
    })
    expect(migrateDocument(undefined)).toEqual({ version: 1, tasks: [], links: [] })
  })

  it('throws for a newer version', () => {
    expect(() => migrateDocument({ version: 2, tasks: [], links: [] })).toThrow('version 2')
  })
})
