import { describe, expect, it } from 'vitest'
import { applySteps, checkDocument, DashboardHistory, migrateDocument } from '..'
import type { DashboardDocument } from '..'

const doc = (): DashboardDocument => ({
  version: 1,
  widgets: [
    { id: 'a', type: 'stat', title: '订单', place: { lg: { x: 0, y: 0, w: 3, h: 2 } } },
    { id: 'b', type: 'note', props: { text: '戴兜' }, place: { lg: { x: 3, y: 0, w: 3, h: 2 } } },
  ],
})

describe('applySteps', () => {
  it('adds, updates and removes, keeping untouched widgets', () => {
    const before = doc()
    const tr = applySteps(before, [
      { type: 'add', widget: { id: 'c', type: 'stat', place: {} }, index: 1 },
      { type: 'update', id: 'a', patch: { title: undefined, props: { value: 1 } } },
      { type: 'remove', id: 'b' },
    ])
    expect(tr.changed).toBe(true)
    expect(tr.doc.widgets.map((widget) => widget.id)).toEqual(['a', 'c'])
    expect(tr.doc.widgets[0]).toEqual({
      id: 'a',
      type: 'stat',
      props: { value: 1 },
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
    })
    expect(before.widgets).toHaveLength(2)
    // the inverse brings the document back
    expect(applySteps(tr.doc, tr.inverse).doc).toEqual(before)
  })

  it('skips steps that change nothing', () => {
    const before = doc()
    const tr = applySteps(before, [
      { type: 'update', id: 'a', patch: { place: { lg: { y: 0, x: 0, h: 2, w: 3 } } } },
      { type: 'update', id: 'missing', patch: { title: 'x' } },
      { type: 'add', widget: { id: 'a', type: 'stat', place: {} }, index: 0 },
    ])
    expect(tr.changed).toBe(false)
    expect(tr.doc).toBe(before)
  })

  it('refuses to change an id or type', () => {
    expect(() =>
      applySteps(doc(), [{ type: 'update', id: 'a', patch: { type: 'note' } as never }]),
    ).toThrow('cannot be changed')
  })
})

describe('DashboardHistory', () => {
  it('undoes and redoes, merging a group', () => {
    const history = new DashboardHistory()
    let current = doc()
    const run = (title: string, now: number) => {
      const tr = applySteps(current, [{ type: 'update', id: 'a', patch: { title } }], {
        group: 'title',
      })
      history.record(tr, now)
      current = tr.doc
    }
    run('订单数', 0)
    run('今日订单', 500)
    expect(history.canUndo).toBe(true)
    current = history.undo(current)!.doc
    expect(current.widgets[0]!.title).toBe('订单')
    expect(history.canUndo).toBe(false)
    current = history.redo(current)!.doc
    expect(current.widgets[0]!.title).toBe('今日订单')
  })

  it('leaves out changes marked history: false', () => {
    const history = new DashboardHistory()
    history.record(applySteps(doc(), [{ type: 'remove', id: 'a' }], { history: false }))
    expect(history.canUndo).toBe(false)
  })
})

describe('checkDocument and migrateDocument', () => {
  it('finds duplicate ids, unknown types and bad places', () => {
    const problems = checkDocument(
      {
        version: 1,
        widgets: [
          { id: 'a', type: 'stat', place: { lg: { x: 0, y: 0, w: 0, h: 2 } } },
          { id: 'a', type: 'pie', place: {} },
        ],
      },
      { widgets: [{ type: 'stat', label: '统计数字', component: {} }] },
    )
    expect(problems.map((problem) => [problem.code, problem.path])).toEqual([
      ['bad-place', 'widgets[0].place.lg'],
      ['duplicate-id', 'widgets[1]'],
      ['unknown-type', 'widgets[1]'],
    ])
  })

  it('fills what an older document lacks', () => {
    expect(
      migrateDocument({
        widgets: [
          { id: 'a', type: 'stat', place: { lg: { x: 0, y: 0, w: 2, h: 2 }, sm: { x: -1 } } },
          { id: 'b', type: 'note' },
          null,
        ],
      }),
    ).toEqual({
      version: 1,
      widgets: [
        { id: 'a', type: 'stat', place: { lg: { x: 0, y: 0, w: 2, h: 2 } } },
        { id: 'b', type: 'note', place: {} },
      ],
    })
    expect(() => migrateDocument({ version: 2 })).toThrow('unknown document version 2')
    expect(() => migrateDocument([])).toThrow('[@dou-ui/dashboard]')
  })
})
