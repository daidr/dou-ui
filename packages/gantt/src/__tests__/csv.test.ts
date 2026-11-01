import { describe, expect, it } from 'vitest'
import { resolveCalendar } from '../core/calendar'
import { applyGanttCSV, parseGanttCSV, splitCSV } from '../core/csv'
import { GanttTransaction, type GanttDocument } from '../core/transaction'
import { ganttLocales } from '../locale'
import type { GanttColumn } from '../types'

const context = (
  columns: GanttColumn[] = [{ key: 'title' }, { key: 'start' }, { key: 'duration' }],
) => ({
  columns,
  messages: ganttLocales['zh-CN']!,
  calendar: resolveCalendar(),
})
const parse = (text: string, columns?: GanttColumn[]) => parseGanttCSV(text, context(columns))
const withoutIds = (text: string, columns?: GanttColumn[]) =>
  parse(text, columns).tasks.map(({ id: _id, ...task }) => task)

describe('splitCSV', () => {
  it('reads quoted fields, line breaks and a byte order mark', () => {
    expect(splitCSV('﻿a,"b,""c"""\r\n"x\ny",\n')).toEqual([
      ['a', 'b,"c"'],
      ['x\ny', ''],
    ])
  })

  it('finds a semicolon or tab between fields', () => {
    expect(splitCSV('a;b;c\n1,5;2;3')).toEqual([
      ['a', 'b', 'c'],
      ['1,5', '2', '3'],
    ])
    expect(splitCSV('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseGanttCSV', () => {
  it('counts durations in working days, skipping weekends', () => {
    // 2026-03-06 is a Friday: three working days end on Tuesday
    expect(withoutIds('任务,开始,工期（天）\n上线准备,2026-03-06,3\n')).toEqual([
      { title: '上线准备', start: '2026-03-06', end: '2026-03-10' },
    ])
  })

  it('reads working hours, and the unit each value has when both are in', () => {
    expect(withoutIds('任务,开始,工期（小时）\n评审,2026-03-03 10:00,2')).toEqual([
      { title: '评审', start: '2026-03-03 10:00', end: '2026-03-03 12:00' },
    ])
    expect(
      withoutIds(
        '任务,开始,工期\n设计,2026-03-02,5 天\n评审,2026-03-03 10:00,2 小时\n站会,2026-03-04 09:00,1h',
      ),
    ).toEqual([
      { title: '设计', start: '2026-03-02', end: '2026-03-06' },
      { title: '评审', start: '2026-03-03 10:00', end: '2026-03-03 12:00' },
      { title: '站会', start: '2026-03-04 09:00', end: '2026-03-04 10:00' },
    ])
  })

  it('reads headers in any built-in language, or as column keys', () => {
    const columns: GanttColumn[] = [
      { key: 'title' },
      { key: 'start' },
      { key: 'end' },
      { key: 'progress' },
    ]
    expect(withoutIds('Task,Start,End,Progress\nDesign,2026-03-02,2026-03-06,40', columns)).toEqual(
      [{ title: 'Design', start: '2026-03-02', end: '2026-03-06', progress: 0.4 }],
    )
    expect(withoutIds('title,start,end\n设计,2026-03-02,2026-03-06', columns)).toEqual([
      { title: '设计', start: '2026-03-02', end: '2026-03-06' },
    ])
  })

  it('makes a milestone of a start without an end or a duration', () => {
    expect(withoutIds('任务,开始,工期\n上线,2026-03-16,\n待定,,')).toEqual([
      { title: '上线', start: '2026-03-16', type: 'milestone' },
      { title: '待定' },
    ])
    // without either column there is nothing to tell: a task of one day
    expect(withoutIds('任务,开始\n上线,2026-03-16', [{ key: 'title' }, { key: 'start' }])).toEqual([
      { title: '上线', start: '2026-03-16', end: '2026-03-16' },
    ])
  })

  it('reports values it cannot read, and headers that are no column', () => {
    const columns: GanttColumn[] = [
      { key: 'title' },
      { key: 'start' },
      { key: 'end' },
      { key: 'progress' },
    ]
    const result = parse(
      '任务,开始,结束,进度,备注\n设计,3月2日,,\n开发,2026-03-09,2026-03-01,很多\n\n测试,2026-03-10,,',
      columns,
    )
    expect(result.problems).toEqual([
      { row: 2, column: 'start', text: '3月2日' },
      { row: 3, column: 'end', text: '2026-03-01' },
      { row: 3, column: 'progress', text: '很多' },
    ])
    expect(result.unknownColumns).toEqual(['备注'])
    expect(result.tasks.map(({ id: _id, ...task }) => task)).toEqual([
      { title: '设计' },
      { title: '开发', start: '2026-03-09', end: '2026-03-09' },
      { title: '测试', start: '2026-03-10', type: 'milestone' },
    ])
  })

  it('rebuilds the tree from ids, leaving out parents that are missing or loop', () => {
    const result = parse(
      'ID,上级任务 ID,任务,开始,工期\np,,发布,2026-03-02,11\na,p,设计,2026-03-02,5\na,p,重复,2026-03-02,1\nx,y,孤立,,\nc1,c2,甲,,\nc2,c1,乙,,',
    )
    expect(result.tasks.slice(0, 2)).toEqual([
      { id: 'p', title: '发布' },
      { id: 'a', parent: 'p', title: '设计', start: '2026-03-02', end: '2026-03-06' },
    ])
    expect(result.tasks[2]!.id).not.toBe('a')
    expect(result.tasks.find((task) => task.title === '孤立')!.parent).toBeUndefined()
    expect(result.tasks.find((task) => task.title === '甲')!.parent).toBe('c2')
    expect(result.tasks.find((task) => task.title === '乙')!.parent).toBeUndefined()
    expect(result.problems).toEqual([
      { row: 4, column: 'id', text: 'a' },
      { row: 5, column: 'parent', text: 'y' },
      { row: 7, column: 'parent', text: 'c1' },
    ])
  })

  it('writes columns of your own to data, through parse', () => {
    const columns: GanttColumn[] = [
      { key: 'title' },
      { key: 'owner', title: '负责人' },
      {
        key: 'points',
        title: '点数',
        parse: (text) => (Number.isFinite(Number(text)) ? Number(text) : undefined),
      },
      // a column that only reads a value can't be written back
      { key: 'code', title: '编号', value: (task) => task.id },
    ]
    const result = parse('任务,负责人,点数,编号\n设计,戴兜,3,a\n开发,,很多,b', columns)
    expect(result.tasks.map(({ id: _id, ...task }) => task)).toEqual([
      { title: '设计', data: { owner: '戴兜', points: 3 } },
      { title: '开发' },
    ])
    expect(result.problems).toEqual([{ row: 3, column: 'points', text: '很多' }])
    expect(result.unknownColumns).toEqual(['编号'])
  })

  it('throws when no header is the title column', () => {
    expect(() => parse('名称,日期\n一,2026-03-02')).toThrow(/title column/)
    expect(() => parse('')).toThrow(/title column/)
  })
})

const doc = (): GanttDocument => ({
  tasks: [
    { id: 'p', title: '发布' },
    {
      id: 'a',
      parent: 'p',
      title: '设计',
      start: '2026-03-02',
      end: '2026-03-04',
      data: { owner: '戴兜', note: '先出稿' },
    },
    { id: 'm', parent: 'p', title: '上线', type: 'milestone', start: '2026-03-16' },
  ],
  links: [{ id: 'l', from: 'a', to: 'm' }],
})

const apply = (text: string, columns?: GanttColumn[]) => {
  const tr = new GanttTransaction(doc())
  applyGanttCSV(tr, parse(text, columns), 'replace', resolveCalendar())
  return tr.doc
}

describe('applyGanttCSV', () => {
  it('moves a task keeping its work when the file has no end or duration', () => {
    // three working days from Friday end on Tuesday
    const { tasks } = apply('id,任务,开始\na,设计,2026-03-06', [{ key: 'title' }, { key: 'start' }])
    expect(tasks).toEqual([
      {
        id: 'a',
        title: '设计',
        start: '2026-03-06',
        end: '2026-03-10',
        data: { owner: '戴兜', note: '先出稿' },
      },
    ])
  })

  it('keeps a task whose parent is gone, at the top', () => {
    const { tasks, links } = apply('id,任务,开始,工期\na,设计,2026-03-02,3\nm,上线,2026-03-16,')
    expect(tasks.map((task) => [task.id, task.parent])).toEqual([
      ['a', undefined],
      ['m', undefined],
    ])
    expect(links).toHaveLength(1)
  })

  it('writes the columns of your own the file has, and leaves the others', () => {
    const columns: GanttColumn[] = [{ key: 'title' }, { key: 'owner', title: '负责人' }]
    const { tasks } = apply('id,任务,负责人\np,发布,\na,设计,\nm,上线,', columns)
    expect(tasks.find((task) => task.id === 'a')!.data).toEqual({ note: '先出稿' })
  })
})
