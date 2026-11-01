import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { spanOf, type GanttTask } from '../../index'
import {
  DouScheduler,
  findConflict,
  groupByResource,
  loadSegments,
  packLanes,
  type SchedulerResource,
} from '..'
import type { SchedulerMenuTarget, SchedulerMove, SchedulerRange } from '../types'
import { bind, planRef } from '../../__tests__/plan-ref'

const resources: SchedulerResource[] = [
  { id: 'dai', title: '戴兜', group: '设计' },
  { id: 'qing', title: '阿青', group: '设计' },
  { id: 'man', title: '林小满', capacity: 2 },
]

const sample = (): GanttTask[] => [
  { id: 'a', title: '会员页', resource: 'dai', start: '2026-03-02', end: '2026-03-04' },
  { id: 'b', title: '图标', resource: 'dai', start: '2026-03-04', end: '2026-03-05' },
  { id: 'c', title: '海报', resource: 'qing', start: '2026-03-03', end: '2026-03-03' },
  { id: 'd', title: '支付', resource: 'man', start: '2026-03-02', end: '2026-03-06' },
  { id: 'e', title: '导出', resource: 'man', start: '2026-03-03', end: '2026-03-04' },
  { id: 'f', title: '需求', start: '2026-03-05' },
]

function setup(extra: Record<string, unknown> = {}) {
  const { doc, tasks } = planRef(sample())
  const selection = ref<string[]>([])
  const ranges: SchedulerRange[] = []
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouScheduler, {
          ...bind(doc),
          selection: selection.value,
          'onUpdate:selection': (value: string[]) => (selection.value = value),
          resources,
          onCreate: (range: SchedulerRange) => ranges.push(range),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  return { wrapper, tasks, selection, ranges }
}

const task = (tasks: { value: GanttTask[] }, id: string) =>
  tasks.value.find((item) => item.id === id)!

// happy-dom lays nothing out: the chart sits at 0,0 with the 56px header on top
const pointer = (type: string, x: number, y: number, el: EventTarget = window) =>
  el.dispatchEvent(
    new PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 1, bubbles: true }),
  )
const pressKey = async (el: Element, key: string, init: KeyboardEventInit = {}) => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  await nextTick()
}
const leftOf = (el: { attributes: (name: string) => string | undefined }) =>
  Number.parseFloat(/left: ([\d.-]+)px/.exec(el.attributes('style') ?? '')![1]!)

describe('scheduler layout', () => {
  it('puts overlapping tasks in separate lanes', () => {
    const items = [
      { span: { start: 0, end: 10, dateOnly: false }, lane: -1 },
      { span: { start: 5, end: 15, dateOnly: false }, lane: -1 },
      { span: { start: 10, end: 20, dateOnly: false }, lane: -1 },
      { span: { start: 6, end: 8, dateOnly: false }, lane: -1 },
    ]
    expect(packLanes(items)).toBe(3)
    expect(items.map((item) => item.lane)).toEqual([0, 1, 0, 2])
  })

  it('counts how many tasks go on at once', () => {
    expect(
      loadSegments([
        { start: 0, end: 10, dateOnly: false },
        { start: 5, end: 15, dateOnly: false },
        { start: 20, end: 30, dateOnly: false },
        // a milestone is not work
        { start: 25, end: 25, dateOnly: false },
      ]),
    ).toEqual([
      { start: 0, end: 5, count: 1 },
      { start: 5, end: 10, count: 2 },
      { start: 10, end: 15, count: 1 },
      { start: 20, end: 30, count: 1 },
    ])
  })

  it('groups tasks by resource, unknown and missing ones together', () => {
    const groups = groupByResource(
      [...sample(), { id: 'g', title: '其他', resource: 'nobody', start: '2026-03-02' }],
      resources,
    )
    // 会员页 runs to the end of 3/4, when 图标 starts
    expect(groups.get('dai')!.lanes).toBe(2)
    expect(groups.get('qing')!.lanes).toBe(1)
    expect(groups.get('man')!.lanes).toBe(2)
    expect(groups.get('')!.items.map((item) => item.task.id)).toEqual(['f', 'g'])
  })
})

describe('findConflict', () => {
  const booked: GanttTask[] = [
    { id: 'x', title: '周会', resource: '301', start: '2026-03-02 09:30', end: '2026-03-02 10:30' },
    { id: 'y', title: '面试', resource: '302', start: '2026-03-02 10:00', end: '2026-03-02 11:00' },
  ]
  it('finds a task on the same resource at the same time', () => {
    expect(
      findConflict(booked, { resource: '301', start: '2026-03-02 10:00', end: '2026-03-02 11:00' })
        ?.id,
    ).toBe('x')
  })
  it('lets tasks touch, and ignores other resources, the task itself and no resource', () => {
    const at = { start: '2026-03-02 10:30', end: '2026-03-02 11:30' }
    expect(findConflict(booked, { resource: '301', ...at })).toBeUndefined()
    expect(
      findConflict(booked, { resource: '303', start: '2026-03-02 10:00', end: '2026-03-02 11:00' }),
    ).toBeUndefined()
    expect(
      findConflict(booked, { task: booked[0], resource: '301', start: '2026-03-02 10:00' }),
    ).toBeUndefined()
    expect(findConflict(booked, { start: '2026-03-02 10:00' })).toBeUndefined()
  })
  it('counts a whole day against the times in it', () => {
    expect(findConflict(booked, { resource: '302', start: '2026-03-02' })?.id).toBe('y')
  })
})

describe('DouScheduler', () => {
  it('lists the resources under their groups, rows as tall as their lanes', async () => {
    const { wrapper } = setup()
    await nextTick()
    const rows = wrapper.findAll('.dou-gantt__tr')
    expect(rows.map((row) => row.text())).toEqual(['设计', '戴兜', '阿青', '林小满', '未分配'])
    // 林小满 has two lanes: 36 + 28
    expect(rows[3]!.attributes('style')).toContain('height: 64px')
    // 戴兜 has two tasks at once and can take one: overloaded
    expect(rows[1]!.classes()).toContain('is-overloaded')
    expect(rows[3]!.classes()).not.toContain('is-overloaded')
    expect(wrapper.findAll('.dou-gantt__bar')).toHaveLength(6)
  })

  it('folds a group', async () => {
    const { wrapper } = setup()
    await nextTick()
    await wrapper.find('.dou-gantt__toggle').trigger('click')
    expect(wrapper.findAll('.dou-gantt__tr').map((row) => row.text())).toEqual([
      '设计',
      '林小满',
      '未分配',
    ])
  })

  it('moves a task in time and to another resource by dragging', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const bar = wrapper.find('.dou-gantt__bar[data-task="c"]')
    const x = leftOf(bar) + 10
    // 阿青's row: header 56 + group 36 + 戴兜 64, so 156 to 192
    pointer('pointerdown', x, 170, bar.element)
    pointer('pointermove', x + 20, 170)
    pointer('pointermove', x + 40, 210)
    await nextTick()
    // shown where it would go while dragging
    expect(wrapper.find('.dou-gantt__tr[data-row="man"]').attributes('style')).toContain(
      'height: 92px',
    )
    pointer('pointerup', x + 40, 210)
    await nextTick()
    await nextTick()
    // a day later, now with 林小满
    expect(task(tasks, 'c')).toMatchObject({
      resource: 'man',
      start: '2026-03-04',
      end: '2026-03-04',
    })
    expect(wrapper.find('[aria-live]').text()).toBe('海报已移到林小满')
  })

  it('resizes a task by its end', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const handle = wrapper.find('.dou-gantt__bar[data-task="b"] ~ .dou-gantt__handle.is-end')
    const x = leftOf(handle)
    pointer('pointerdown', x, 100, handle.element)
    pointer('pointermove', x + 40, 100)
    pointer('pointerup', x + 40, 100)
    await nextTick()
    expect(task(tasks, 'b')).toMatchObject({ start: '2026-03-04', end: '2026-03-06' })
  })

  it('hands over a range drawn on an empty part of a row', async () => {
    const { wrapper, ranges } = setup()
    await nextTick()
    const body = wrapper.find('.dou-gantt__body')
    // on screen: the bar's place in the timeline, less how far it is scrolled
    const scrolled = wrapper.find('.dou-gantt__chart').element.scrollLeft
    const start = leftOf(wrapper.find('.dou-gantt__bar[data-task="c"]')) - scrolled
    // 阿青's row, from 3/3 to 3/5
    pointer('pointerdown', start + 4, 170, body.element)
    pointer('pointermove', start + 60, 170)
    pointer('pointermove', start + 100, 170)
    pointer('pointerup', start + 100, 170)
    await nextTick()
    expect(ranges).toEqual([{ resource: 'qing', start: '2026-03-03', end: '2026-03-05' }])
  })

  it('moves the focused task with Alt and the arrow keys, and undoes it', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const root = wrapper.find('.dou-gantt').element
    await pressKey(root, 'ArrowDown')
    // the first task in reading order
    expect(wrapper.find('.dou-gantt__bar.is-active').attributes('data-task')).toBe('a')
    await pressKey(root, 'ArrowRight', { altKey: true })
    expect(task(tasks, 'a')).toMatchObject({ start: '2026-03-03', end: '2026-03-05' })
    await pressKey(root, 'ArrowDown', { altKey: true })
    expect(task(tasks, 'a').resource).toBe('qing')
    await pressKey(root, 'z', { ctrlKey: true })
    await pressKey(root, 'z', { ctrlKey: true })
    expect(task(tasks, 'a')).toMatchObject({ resource: 'dai', start: '2026-03-02' })
  })

  it('removes the selected tasks with Delete', async () => {
    const { wrapper, tasks, selection } = setup()
    await nextTick()
    await wrapper.find('.dou-gantt__bar[data-task="e"]').trigger('click')
    expect(selection.value).toEqual(['e'])
    await pressKey(wrapper.find('.dou-gantt').element, 'Delete')
    expect(tasks.value.some((item) => item.id === 'e')).toBe(false)
    expect(selection.value).toEqual([])
  })

  it('refuses a move that canMove turns down, and says why', async () => {
    const seen: SchedulerMove[] = []
    const canMove = (move: SchedulerMove) => {
      seen.push(move)
      return move.resource === 'man' ? '林小满这周请假' : true
    }
    const { wrapper, tasks } = setup({ canMove })
    await nextTick()
    const bar = wrapper.find('.dou-gantt__bar[data-task="c"]')
    const x = leftOf(bar) + 10
    pointer('pointerdown', x, 170, bar.element)
    pointer('pointermove', x + 20, 170)
    pointer('pointermove', x + 20, 210)
    await nextTick()
    expect(wrapper.find('.dou-gantt__tip').text()).toBe('林小满这周请假')
    expect(wrapper.find('.dou-gantt__bar[data-task="c"]').classes()).toContain('is-move-refused')
    pointer('pointerup', x + 20, 210)
    await nextTick()
    await nextTick()
    expect(task(tasks, 'c').resource).toBe('qing')
    expect(seen.at(-1)).toMatchObject({ resource: 'man', start: '2026-03-04' })
    expect(wrapper.find('[aria-live]').text()).toBe('林小满这周请假')
    // the keys ask too
    const root = wrapper.find('.dou-gantt').element
    await pressKey(root, 'ArrowDown')
    await pressKey(root, 'ArrowDown')
    expect(wrapper.find('.dou-gantt__bar.is-active').attributes('data-task')).toBe('c')
    await pressKey(root, 'ArrowDown', { altKey: true })
    expect(task(tasks, 'c').resource).toBe('qing')
  })

  it('reads out tasks as the gantt chart does, with their resource', async () => {
    const { wrapper } = setup()
    await nextTick()
    // a single day reads as one date
    expect(wrapper.find('.dou-gantt__bar[data-task="c"]').attributes('aria-label')).toBe(
      '海报，3月3日，1 天，阿青',
    )
    expect(wrapper.find('.dou-gantt__bar[data-task="a"]').attributes('aria-label')).toBe(
      '会员页，3月2日至3月4日，3 天，戴兜',
    )
  })

  it('says a task on a day off has no working time', async () => {
    const { wrapper } = setup()
    await nextTick()
    const vm = wrapper.findComponent(DouScheduler).vm as unknown as {
      transact: (fn: (tr: { addTask: (task: GanttTask) => void }) => void) => void
    }
    // 3月7日 is a Saturday
    vm.transact((tr) =>
      tr.addTask({ id: 's', title: '值班', resource: 'qing', start: '2026-03-07' }),
    )
    await nextTick()
    expect(wrapper.find('.dou-gantt__bar[data-task="s"]').attributes('aria-label')).toBe(
      '值班，3月7日，休息日，阿青',
    )
  })

  it('reads out tasks added from outside, and undoes them', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const vm = wrapper.findComponent(DouScheduler).vm as unknown as {
      transact: (fn: (tr: { addTask: (task: GanttTask) => void }) => void) => void
    }
    vm.transact((tr) =>
      tr.addTask({ id: 'n', title: '新预约', resource: 'qing', start: '2026-03-05' }),
    )
    await nextTick()
    await nextTick()
    expect(wrapper.find('[aria-live]').text()).toBe('已添加新预约')
    await pressKey(wrapper.find('.dou-gantt').element, 'z', { ctrlKey: true })
    expect(tasks.value.some((item) => item.id === 'n')).toBe(false)
  })

  it('sends taskContextmenu before a menu opened by the menu key', async () => {
    const seen: string[] = []
    const onTaskContextmenu = (item: GanttTask, event: MouseEvent) => {
      seen.push(item.id)
      event.preventDefault()
    }
    const { wrapper } = setup({ onTaskContextmenu })
    await nextTick()
    const bar = wrapper.find('.dou-gantt__bar[data-task="a"]')
    await bar.trigger('click')
    await pressKey(bar.element, 'F10', { shiftKey: true })
    await nextTick()
    expect(seen).toEqual(['a'])
    expect(document.querySelector('[role="menuitem"]')).toBeNull()
    wrapper.unmount()
  })

  it('opens a menu with your items before the built-in one', async () => {
    const run = vi.fn<(id: string) => void>()
    const targets: SchedulerMenuTarget[] = []
    const contextMenu = (target: SchedulerMenuTarget) => {
      targets.push(target)
      return target.kind === 'task'
        ? [{ key: 'details', label: '详情', run: () => run(target.task.id) }]
        : [{ key: 'book', label: '在此预约', run: () => {} }]
    }
    const { wrapper } = setup({ contextMenu })
    await nextTick()
    await wrapper.find('.dou-gantt__bar[data-task="a"]').trigger('contextmenu')
    await nextTick()
    await nextTick()
    const items = [...document.querySelectorAll('[role="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    )
    expect(items[0]).toBe('详情')
    expect(items.some((text) => text?.startsWith('删除任务'))).toBe(true)
    ;(document.querySelector('[role="menuitem"]') as HTMLElement).click()
    expect(run).toHaveBeenCalledWith('a')
    expect(targets[0]).toMatchObject({ kind: 'task', resource: { id: 'dai' } })
    wrapper.unmount()
  })

  it('stays put when read-only', async () => {
    const { wrapper, tasks } = setup({ readonly: true })
    await nextTick()
    const bar = wrapper.find('.dou-gantt__bar[data-task="a"]')
    const x = leftOf(bar) + 10
    pointer('pointerdown', x, 100, bar.element)
    pointer('pointermove', x + 80, 100)
    pointer('pointerup', x + 80, 100)
    await nextTick()
    expect(spanOf(task(tasks, 'a'))).toEqual(spanOf(sample()[0]!))
    expect(wrapper.find('.dou-gantt__handle').exists()).toBe(false)
  })
})
