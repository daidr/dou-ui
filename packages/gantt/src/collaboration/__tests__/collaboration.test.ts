import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { collaboration, fillMaps } from '..'
import { DouGantt, type GanttExpose, type GanttLink, type GanttTask } from '../../index'

const START = (): GanttTask[] => [
  { id: 'p', title: '发布' },
  { id: 'a', parent: 'p', title: '设计', start: '2026-03-02', end: '2026-03-06' },
  { id: 'b', parent: 'p', title: '开发', start: '2026-03-09', end: '2026-03-13' },
]
const LINKS = (): GanttLink[] => [{ id: 'l1', from: 'a', to: 'b' }]

const wrappers: VueWrapper[] = []
const awarenesses: Awareness[] = []

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  for (const awareness of awarenesses.splice(0)) awareness.destroy()
})

/** A client: its own Y.Doc and a chart bound to it, starting from `tasks`. */
function client(
  tasks: GanttTask[] = [],
  links: GanttLink[] = [],
  options: { doc?: Y.Doc; awareness?: boolean; props?: Record<string, unknown> } = {},
) {
  const doc = options.doc ?? new Y.Doc()
  const awareness = options.awareness ? new Awareness(doc) : undefined
  if (awareness) awarenesses.push(awareness)
  const state = { tasks: ref(tasks), links: ref(links), selection: ref<string[]>([]) }
  const chart = ref<GanttExpose>()
  const extensions = [
    collaboration({
      tasks: doc.getMap('tasks'),
      links: doc.getMap('links'),
      awareness,
      user: { name: `用户 ${doc.clientID}` },
    }),
  ]
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouGantt, {
          ref: chart,
          tasks: state.tasks.value,
          'onUpdate:tasks': (value: GanttTask[]) => (state.tasks.value = value),
          links: state.links.value,
          'onUpdate:links': (value: GanttLink[]) => (state.links.value = value),
          selection: state.selection.value,
          'onUpdate:selection': (value: string[]) => (state.selection.value = value),
          // written inline, so it is a new list on every render
          extensions: [...extensions],
          ...options.props,
        }),
    ),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  const task = (id: string) => state.tasks.value.find((item) => item.id === id)
  return { doc, awareness, wrapper, chart, task, ...state }
}

/** Relays updates between two docs, like a server would; the line can be cut. */
function connect(a: Y.Doc, b: Y.Doc) {
  let online = true
  const pending: [Y.Doc, Uint8Array][] = []
  const relay = (from: Y.Doc, to: Y.Doc) =>
    from.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'relay') return
      if (online) Y.applyUpdate(to, update, 'relay')
      else pending.push([to, update])
    })
  relay(a, b)
  relay(b, a)
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'relay')
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b), 'relay')
  return {
    offline: () => (online = false),
    online: () => {
      online = true
      for (const [to, update] of pending.splice(0)) Y.applyUpdate(to, update, 'relay')
    },
  }
}

/** Two charts on one plan: the first brings the tasks. */
async function pair(props?: Record<string, unknown>) {
  const one = client(START(), LINKS(), { props })
  await nextTick()
  const two = client([], [], { props })
  const line = connect(one.doc, two.doc)
  await nextTick()
  return { one, two, line }
}

const order = (rows: { tasks: { value: GanttTask[] } }) =>
  rows.tasks.value
    .filter((task) => task.parent === 'p')
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort((x, y) => (x.order! < y.order! ? -1 : x.order! > y.order! ? 1 : x.id < y.id ? -1 : 1))
    .map((task) => task.title)

describe('collaboration', () => {
  it('fills empty maps from the first chart and loads them in the others', async () => {
    const { one, two } = await pair()
    expect(new Set(two.tasks.value.map((task) => task.id))).toEqual(new Set(['a', 'b', 'p']))
    expect(two.links.value).toEqual([{ id: 'l1', from: 'a', to: 'b' }])
    // every task gets an order key, so siblings sort alike everywhere
    expect(one.task('a')!.order).toBeTruthy()
    expect(two.task('a')!.order).toBe(one.task('a')!.order)
    expect(two.wrapper.findAll('.dou-gantt__tr').map((row) => row.attributes('data-row'))).toEqual([
      'p',
      'a',
      'b',
    ])
  })

  it('sends each change to the others', async () => {
    const { one, two } = await pair()
    one.chart.value!.transact((tr) => tr.updateTask('a', { title: '交互设计' }))
    expect(two.task('a')!.title).toBe('交互设计')
    two.chart.value!.transact((tr) => tr.setSpan('b', '2026-03-10', '2026-03-16'))
    expect(one.task('b')).toMatchObject({ start: '2026-03-10', end: '2026-03-16' })
    one.chart.value!.transact((tr) => tr.removeTask('a'))
    expect(two.task('a')).toBeUndefined()
    expect(two.links.value).toEqual([])
  })

  it('undoes only this user’s own changes', async () => {
    const { one, two } = await pair()
    one.chart.value!.transact((tr) => tr.updateTask('a', { title: '交互设计' }))
    two.chart.value!.transact((tr) => tr.updateTask('b', { title: '前端开发' }))
    expect(one.chart.value!.canUndo).toBe(true)
    expect(one.chart.value!.undo()).toBe(true)
    expect(one.task('a')!.title).toBe('设计')
    expect(two.task('a')!.title).toBe('设计')
    // the other person's change stays
    expect(one.task('b')!.title).toBe('前端开发')
    expect(one.chart.value!.canUndo).toBe(false)
    expect(one.chart.value!.redo()).toBe(true)
    expect(two.task('a')!.title).toBe('交互设计')
  })

  it('merges changes made while offline', async () => {
    const { one, two, line } = await pair()
    line.offline()
    one.chart.value!.transact((tr) => tr.updateTask('b', { title: '前端开发' }))
    two.chart.value!.transact((tr) => tr.setSpan('b', '2026-03-10', '2026-03-17'))
    line.online()
    for (const side of [one, two])
      expect(side.task('b')).toMatchObject({
        title: '前端开发',
        start: '2026-03-10',
        end: '2026-03-17',
      })
  })

  it('places tasks added at the same spot alike for everyone', async () => {
    const { one, two, line } = await pair()
    line.offline()
    one.chart.value!.transact((tr) => tr.addTask({ id: 'x', parent: 'p', title: '文档' }))
    two.chart.value!.transact((tr) => tr.addTask({ id: 'y', parent: 'p', title: '测试' }))
    line.online()
    await nextTick()
    const rows = (side: typeof one) =>
      side.wrapper.findAll('.dou-gantt__tr').map((row) => row.attributes('data-row'))
    expect(rows(one)).toEqual(rows(two))
    expect(order(one)).toEqual(['设计', '开发', '文档', '测试'])
  })

  it('leaves out links to a task someone else removed', async () => {
    const { one, two, line } = await pair()
    line.offline()
    one.chart.value!.transact((tr) => tr.removeTask('a'))
    two.chart.value!.transact((tr) => tr.addLink({ id: 'l2', from: 'a', to: 'b', type: 'ss' }))
    line.online()
    await nextTick()
    for (const side of [one, two]) {
      expect(side.links.value.map((link) => link.id)).toEqual(['l2'])
      expect(side.wrapper.findAll('.dou-gantt__link')).toHaveLength(0)
      expect(side.wrapper.findAll('.dou-gantt__tr')).toHaveLength(2)
    }
  })

  it('keeps folding to each person', async () => {
    const { one, two } = await pair()
    one.chart.value!.transact((tr) => tr.updateTask('p', { collapsed: true }))
    expect(one.task('p')!.collapsed).toBe(true)
    expect(two.task('p')!.collapsed).toBeUndefined()
    two.chart.value!.transact((tr) => tr.updateTask('p', { title: '首次发布' }))
    expect(one.task('p')).toMatchObject({ title: '首次发布', collapsed: true })
  })

  it('leaves the pushing to the person who made the change', async () => {
    const { one, two } = await pair({ scheduling: 'auto' })
    one.chart.value!.transact((tr) => tr.setSpan('a', '2026-03-09', '2026-03-13'))
    // pushed on the first chart, and the push arrives as it is
    expect(one.task('b')).toMatchObject({ start: '2026-03-16', end: '2026-03-20' })
    expect(two.task('b')).toMatchObject({ start: '2026-03-16', end: '2026-03-20' })
    two.chart.value!.undo()
    expect(two.task('b')!.start).toBe('2026-03-16')
    one.chart.value!.undo()
    expect(two.task('b')).toMatchObject({ start: '2026-03-09', end: '2026-03-13' })
  })

  it('shows what the others select', async () => {
    const doc = new Y.Doc()
    fillMaps(
      { tasks: doc.getMap('tasks'), links: doc.getMap('links') },
      {
        tasks: START(),
        links: LINKS(),
      },
    )
    const one = client([], [], { doc, awareness: true })
    const other = new Y.Doc()
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc))
    const two = client([], [], { doc: other, awareness: true })
    await nextTick()
    two.selection.value = ['a']
    await nextTick()
    // relay the awareness by hand
    const { encodeAwarenessUpdate, applyAwarenessUpdate } = await import('y-protocols/awareness')
    applyAwarenessUpdate(
      one.awareness!,
      encodeAwarenessUpdate(two.awareness!, [two.awareness!.clientID]),
      'relay',
    )
    await nextTick()
    const peer = one.wrapper.find('.dou-gantt__peer.is-selected')
    expect(peer.exists()).toBe(true)
    expect(peer.text()).toBe(`用户 ${other.clientID}`)
  })

  it('warns once about values the others would not get', () => {
    const doc = new Y.Doc()
    const tasks = doc.getMap<unknown>('tasks')
    const links = doc.getMap<unknown>('links')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const icon = { name: 'Icon', render: () => null }
    fillMaps(
      { tasks, links },
      {
        tasks: [
          { id: 'x', title: '带图标', data: { icon } },
          { id: 'y', title: '普通', data: { tags: ['a'], owner: { name: '戴兜' } } },
        ],
        links: [],
      },
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('data.icon.render')
    warn.mockRestore()
  })
})
