import { mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { spanOf, type GanttDocument, type GanttMarker, type GanttTask } from '../../index'
import {
  DouScheduler,
  findConflict,
  groupByResource,
  loadSegments,
  packLanes,
  useScheduler,
  type SchedulerCanvasScope,
  type SchedulerContext,
  type SchedulerRailScope,
  type SchedulerResource,
  type SchedulerRowInfo,
} from '..'
import type {
  GanttViewport,
  SchedulerExpose,
  SchedulerMenuTarget,
  SchedulerMove,
  SchedulerRange,
} from '../index'
import { later } from '../../../../../test/later'
import { bind, planRef } from '../../__tests__/plan-ref'

// happy-dom lays nothing out, so a scroller has no room to scroll; the timeline
// gets the width a browser would give it, so a position written to it is read back.
// It gets a box on screen too: with none, every pointer is past its right edge,
// and a drag would scroll the timeline on the next frame, whenever that comes
const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')
const rectOf = HTMLElement.prototype.getBoundingClientRect
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    return this.classList.contains('dou-gantt__chart')
      ? new DOMRect(0, 0, 800, 400)
      : rectOf.call(this)
  }
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('dou-gantt__chart') ? 1e7 : (scrollWidth?.get?.call(this) ?? 0)
    },
  })
})
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = rectOf
  if (scrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidth)
  else delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth
})

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
const pointer = (type: string, x: number, y: number, el: EventTarget = window) => {
  later()
  el.dispatchEvent(
    new PointerEvent(type, { button: 0, clientX: x, clientY: y, pointerId: 1, bubbles: true }),
  )
}
const pressKey = async (el: Element, key: string, init: KeyboardEventInit = {}) => {
  later()
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

  it('packs sub-minute spans without false overlap from point padding', () => {
    const t0 = 100
    const backToBack = [
      { span: { start: t0, end: t0 + 0.5, dateOnly: false }, lane: -1 },
      { span: { start: t0 + 0.5, end: t0 + 1, dateOnly: false }, lane: -1 },
    ]
    expect(packLanes(backToBack)).toBe(1)
    expect(backToBack.map((item) => item.lane)).toEqual([0, 0])

    const overlapping = [
      { span: { start: t0, end: t0 + 0.5, dateOnly: false }, lane: -1 },
      { span: { start: t0 + 0.25, end: t0 + 0.75, dateOnly: false }, lane: -1 },
    ]
    expect(packLanes(overlapping)).toBe(2)
    expect(overlapping.map((item) => item.lane)).toEqual([0, 1])
    expect(loadSegments(overlapping.map((i) => i.span)).some((s) => s.count === 2)).toBe(true)
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

  it('supports live timeline mode with calendar:false, swimlane markers, follow and readonly pan', async () => {
    const base = new Date(2026, 2, 5, 15, 0, 0).getTime()
    const { doc } = planRef([
      { id: 'r1', title: '推理调用', resource: 'agent-a', start: base, end: base + 35_000 },
      {
        id: 'r2',
        title: '工具执行',
        resource: 'agent-a',
        start: base + 35_000,
        end: base + 80_000,
      },
      {
        id: 'r3',
        title: '代码审查',
        resource: 'agent-b',
        start: base + 15_000,
        end: base + 95_000,
      },
    ])
    const swimlanes: SchedulerResource[] = [
      { id: 'agent-a', title: 'Coder' },
      { id: 'agent-b', title: 'Reviewer' },
    ]
    const markers: GanttMarker[] = [
      { id: 'global', date: base + 10_000, label: '触发', tone: 'primary' },
      {
        id: 'ev-a',
        resource: 'agent-a',
        date: base + 50_000,
        label: '等待审批',
        tone: 'warning',
      },
      {
        id: 'ev-b',
        resource: 'agent-b',
        date: base + 70_000,
        label: '评审通过',
        tone: 'success',
      },
    ]
    const follow = ref(true)
    const clicked: GanttMarker[] = []
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouScheduler,
            {
              ...bind(doc),
              resources: swimlanes,
              calendar: false,
              scale: 'minute',
              readonly: true,
              load: false,
              markers,
              follow: follow.value,
              'onUpdate:follow': (value: boolean) => (follow.value = value),
              onMarkerClick: (marker: GanttMarker) => clicked.push(marker),
            },
            {
              marker: ({ marker }: { marker: GanttMarker }) =>
                h('span', { class: 'lane-pin' }, marker.label),
            },
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    expect(wrapper.findAll('.dou-gantt__off')).toHaveLength(0)
    expect(wrapper.find('.dou-gantt').classes()).toContain('is-following')
    expect(wrapper.findAll('.dou-gantt__marker')).toHaveLength(1)

    const vm = wrapper.findComponent(DouScheduler).vm as unknown as SchedulerExpose
    vm.fit([base - 30_000, base + 120_000])
    await nextTick()
    expect(follow.value).toBe(false)

    const events = wrapper.findAll('.dou-gantt__event')
    expect(events).toHaveLength(2)
    expect(events.map((el) => el.find('.lane-pin').text())).toEqual(['等待审批', '评审通过'])
    await events[0]!.trigger('click')
    expect(clicked.map((m) => m.id)).toEqual(['ev-a'])

    // re-enable follow, then drag-pan to detach
    follow.value = true
    await nextTick()
    const chartEl = wrapper.find('.dou-gantt__chart').element as HTMLElement
    const todayScreenX = () => {
      const style = wrapper.find('.dou-gantt__today').attributes('style') ?? ''
      return Number.parseFloat(/left:\s*([\d.-]+)px/.exec(style)![1]!) - chartEl.scrollLeft
    }
    const beforeScreenX = todayScreenX()
    const canvas = wrapper.find('.dou-gantt__canvas').element
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        pointerType: 'mouse',
        clientX: 300,
        clientY: 60,
        bubbles: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerType: 'mouse',
        clientX: 390,
        clientY: 60,
      }),
    )
    await nextTick()
    expect(follow.value).toBe(false)
    expect(todayScreenX() - beforeScreenX).toBeCloseTo(90, 0)
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerType: 'mouse',
        clientX: 390,
        clientY: 60,
      }),
    )
    wrapper.unmount()
  })

  it('keeps side labels from overlapping the next bar on the same lane', async () => {
    const base = new Date(2026, 4, 10, 14, 0, 0).getTime()
    const doc = ref<GanttDocument>({
      version: 1,
      tasks: [
        // intentionally out of chronological order to verify lane sorting
        { id: 'c', title: '汇总进度', resource: 'a', start: base + 360_000, end: base + 420_000 },
        { id: 'a', title: '拆解任务', resource: 'a', start: base, end: base + 60_000 },
        {
          id: 'b',
          title: '分配并行子任务',
          resource: 'a',
          start: base + 65_000,
          end: base + 120_000,
        },
      ],
      links: [],
    })
    const wrapper = mount(DouScheduler, {
      props: {
        modelValue: doc.value,
        resources: [{ id: 'a', title: '调度器' }],
        scale: 'minute',
        calendar: false,
      },
      attachTo: document.body,
    })
    await nextTick()
    const sides = wrapper.findAll('.dou-gantt__bar-side')
    // 'a' is immediately followed by 'b' (5s gap): side label must be suppressed
    expect(sides.some((el) => el.text() === '拆解任务')).toBe(false)
    // 'b' has a 4m gap before 'c': side label is clipped with max-width so it stays clear of 'c'
    const sideB = sides.find((el) => el.text() === '分配并行子任务')
    expect(sideB).toBeDefined()
    expect(sideB!.classes()).toContain('is-clipped')
    // 'c' is last on the lane: unclipped outside label
    const sideC = sides.find((el) => el.text() === '汇总进度')
    expect(sideC).toBeDefined()
    expect(sideC!.classes()).not.toContain('is-clipped')
    wrapper.unmount()
  })

  it('emits viewportChange and exposes getViewport, xOf, timeAt, rowBox and barBox', async () => {
    const base = new Date(2026, 4, 10, 14, 0, 0).getTime()
    const doc = ref<GanttDocument>({
      version: 1,
      tasks: [
        { id: 't1', title: '编译', resource: 'a', start: base, end: base + 120_000 },
        { id: 't2', title: '测试', resource: 'b', start: base + 60_000, end: base + 240_000 },
      ],
      links: [],
    })
    const viewports: GanttViewport[] = []
    const wrapper = mount(DouScheduler, {
      props: {
        modelValue: doc.value,
        resources: [
          { id: 'a', title: 'Agent A', group: '运行中' },
          { id: 'b', title: 'Agent B', group: '运行中' },
        ],
        scale: 'minute',
        calendar: false,
        onViewportChange: (vp: GanttViewport) => viewports.push(vp),
      },
      attachTo: document.body,
    })
    await nextTick()
    const vm = wrapper.vm as unknown as SchedulerExpose
    expect(viewports.length).toBeGreaterThan(0)

    const vp = vm.getViewport()
    expect(vp.scale).toBe('minute')
    expect(vp.width).toBe(800)
    expect(vp.end).toBeGreaterThan(vp.start)

    const x = vm.xOf(base + 60_000)!
    expect(typeof x).toBe('number')
    expect(vm.timeAt(x)).toBeCloseTo(base + 60_000, -1)

    const rowA = vm.rowBox('a')
    const rowB = vm.rowBox('b')
    expect(rowA).not.toBeNull()
    expect(rowB).not.toBeNull()
    expect(rowB!.top).toBeGreaterThan(rowA!.top)

    const bar1 = vm.barBox('t1')
    expect(bar1).not.toBeNull()
    expect(bar1!.resourceId).toBe('a')
    expect(bar1!.left).toBeCloseTo(vm.xOf(base)!, 2)
    expect(bar1!.width).toBeGreaterThan(0)

    const countBefore = viewports.length
    vm.zoomIn()
    await nextTick()
    expect(viewports.length).toBeGreaterThan(countBefore)
    expect(vm.getViewport().dayWidth).toBeGreaterThan(vp.dayWidth)
    wrapper.unmount()
  })

  it('syncs v-model:tableWidth via divider drag and keyboard while protecting document selection', async () => {
    const tableWidth = ref(220)
    const { wrapper } = setup({
      tableWidth: tableWidth.value,
      'onUpdate:tableWidth': (w: number) => (tableWidth.value = w),
    })
    await nextTick()
    expect(wrapper.find('.dou-gantt__table-pane').attributes('style')).toContain('width: 220px')

    const divider = wrapper.find('.dou-gantt__divider')
    divider.element.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 220, pointerId: 1, bubbles: true }),
    )
    await nextTick()
    expect(wrapper.find('.dou-gantt').classes()).toContain('is-resizing')
    expect(document.documentElement.style.userSelect).toBe('none')

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 280, pointerId: 1 }))
    await nextTick()
    expect(tableWidth.value).toBe(280)

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 280, pointerId: 1 }))
    await nextTick()
    expect(wrapper.find('.dou-gantt').classes()).not.toContain('is-resizing')
    expect(document.documentElement.style.userSelect).toBe('')

    await pressKey(divider.element, 'ArrowLeft')
    expect(tableWidth.value).toBe(270)
    await pressKey(divider.element, 'ArrowRight', { shiftKey: true })
    expect(tableWidth.value).toBe(310)
    wrapper.unmount()
  })

  it('supports resourceClick on left list and empty swimlane track, v-model:selectedResource and rowClass', async () => {
    const selectedResource = ref<string | null>(null)
    const clicked: (string | null)[] = []
    const rowInfos: SchedulerRowInfo[] = []
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouScheduler,
            {
              modelValue: { version: 1, tasks: sample(), links: [] },
              resources,
              readonly: true,
              selectedResource: selectedResource.value,
              'onUpdate:selectedResource': (id: string | null) => (selectedResource.value = id),
              onResourceClick: (res: SchedulerResource | null) => clicked.push(res?.id ?? null),
              rowClass: (info: SchedulerRowInfo) => {
                rowInfos.push(info)
                return info.kind === 'resource' && info.key === 'dai' ? 'is-agent-dai' : undefined
              },
            },
            {
              resource: ({ resource }: { resource: SchedulerResource }) =>
                h('div', { class: 'custom-res' }, [
                  h('span', resource.title),
                  h('button', { type: 'button', class: 'res-action' }, '详情'),
                ]),
            },
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    // rowClass applies to both table row and canvas lane row
    expect(wrapper.find('.dou-gantt__tr[data-row="dai"]').classes()).toContain('is-agent-dai')
    expect(wrapper.findAll('.dou-gantt__lane-row.is-agent-dai')).toHaveLength(1)

    // clicking interactive button inside #resource does not trigger resourceClick
    await wrapper.find('.dou-gantt__tr[data-row="dai"] .res-action').trigger('click')
    expect(clicked).toEqual([])

    // clicking left list row selects the resource
    await wrapper.find('.dou-gantt__tr[data-row="dai"]').trigger('click')
    await nextTick()
    expect(selectedResource.value).toBe('dai')
    expect(clicked).toEqual(['dai'])
    expect(wrapper.find('.dou-gantt__tr[data-row="dai"]').classes()).toContain('is-selected')
    expect(wrapper.findAll('.dou-gantt__lane-row.is-selected')).toHaveLength(1)

    // clicking empty track on 'qing' row ('设计'=0..36, 'dai' has 2 lanes=36..100, 'qing'=100..136; header=56)
    const body = wrapper.find('.dou-gantt__body').element
    body.dispatchEvent(new MouseEvent('click', { clientX: 500, clientY: 56 + 115, bubbles: true }))
    await nextTick()
    expect(selectedResource.value).toBe('qing')
    expect(clicked).toEqual(['dai', 'qing'])

    // clicking a task bar must NOT trigger resourceClick
    await wrapper.find('.dou-gantt__bar[data-task="a"]').trigger('click')
    expect(clicked).toEqual(['dai', 'qing'])

    // drag-panning across the body must suppress resourceClick
    const canvas = wrapper.find('.dou-gantt__canvas').element
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        pointerType: 'mouse',
        clientX: 400,
        clientY: 56 + 50,
        bubbles: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 440, clientY: 56 + 50 }),
    )
    window.dispatchEvent(
      new PointerEvent('pointerup', { pointerType: 'mouse', clientX: 440, clientY: 56 + 50 }),
    )
    body.dispatchEvent(new MouseEvent('click', { clientX: 440, clientY: 56 + 50, bubbles: true }))
    await nextTick()
    expect(clicked).toEqual(['dai', 'qing'])
    wrapper.unmount()
  })

  it('supports v-model:collapsedGroups and #group slot', async () => {
    const collapsedGroups = ref<string[]>(['设计'])
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouScheduler,
            {
              modelValue: { version: 1, tasks: sample(), links: [] },
              resources,
              collapsedGroups: collapsedGroups.value,
              'onUpdate:collapsedGroups': (next: string[]) => (collapsedGroups.value = next),
            },
            {
              group: ({
                title,
                count,
                collapsed,
                toggle,
              }: {
                title: string
                count: number
                collapsed: boolean
                toggle: () => void
              }) =>
                h(
                  'button',
                  { type: 'button', class: 'custom-group-btn', onClick: toggle },
                  `${title} (${count}) ${collapsed ? '已折叠' : '已展开'}`,
                ),
            },
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()
    // '设计' starts collapsed: 'dai' and 'qing' rows are hidden
    expect(wrapper.find('.dou-gantt__tr[data-row="dai"]').exists()).toBe(false)
    expect(wrapper.find('.custom-group-btn').text()).toBe('设计 (2) 已折叠')

    await wrapper.find('.custom-group-btn').trigger('click')
    await nextTick()
    expect(collapsedGroups.value).toEqual([])
    expect(wrapper.find('.dou-gantt__tr[data-row="dai"]').exists()).toBe(true)
    expect(wrapper.find('.custom-group-btn').text()).toBe('设计 (2) 已展开')
    wrapper.unmount()
  })

  it('supports barLabel, task class, nativeTitle, #bar-content, #bar-tooltip and #marker-tooltip', async () => {
    const base = new Date(2026, 4, 10, 14, 0, 0).getTime()
    const markers: GanttMarker[] = [
      {
        id: 'ev1',
        resource: 'a',
        date: base + 30_000,
        label: '审阅通过',
        tone: 'success',
        class: 'ev-custom',
      },
    ]
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouScheduler,
            {
              modelValue: {
                version: 1,
                tasks: [
                  {
                    id: 's1',
                    title: '短任务',
                    resource: 'a',
                    start: base,
                    end: base + 10_000,
                    class: ['is-running', { 'is-live': true }],
                  },
                ],
                links: [],
              },
              resources: [{ id: 'a', title: 'Agent A' }],
              markers,
              scale: 'minute',
              calendar: false,
              barLabel: 'none',
              nativeTitle: false,
            },
            {
              'bar-content': ({ task: item }: { task: GanttTask }) =>
                h('span', { class: 'pulse-dot', 'data-id': item.id }),
              'bar-tooltip': ({ task: item }: { task: GanttTask }) =>
                h('div', { class: 'rich-bar-tip' }, `详情：${item.title}`),
              'marker-tooltip': ({ marker }: { marker: GanttMarker }) =>
                h('div', { class: 'rich-marker-tip' }, `事件：${marker.label}`),
            },
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    const bar = wrapper.find('.dou-gantt__bar[data-task="s1"]')
    expect(bar.classes()).toContain('is-running')
    expect(bar.classes()).toContain('is-live')
    // barLabel='none' hides standard text labels, while #bar-content still mounts inside the bar
    expect(wrapper.find('.dou-gantt__bar-label').exists()).toBe(false)
    expect(wrapper.find('.dou-gantt__bar-side').exists()).toBe(false)
    expect(bar.find('.pulse-dot').exists()).toBe(true)
    // native title is suppressed when #bar-tooltip / nativeTitle=false
    expect(bar.attributes('title')).toBeUndefined()

    const ev = wrapper.find('.dou-gantt__event')
    expect(ev.classes()).toContain('ev-custom')
    expect(ev.attributes('title')).toBeUndefined()
    wrapper.unmount()
  })

  it('renders shaded marker bands, top auxiliary rail, canvas layers and useScheduler() context', async () => {
    const base = new Date(2026, 4, 10, 14, 0, 0).getTime()
    const markers: GanttMarker[] = [
      {
        id: 'away',
        date: base - 120_000,
        endDate: base + 120_000,
        label: '离开期间',
        tone: 'warning',
        class: 'away-band',
      },
      {
        id: 'row-band',
        resource: 'a',
        date: base,
        endDate: base + 60_000,
        tone: 'primary',
      },
    ]
    let capturedRail: SchedulerRailScope | null = null
    let capturedOverlay: SchedulerCanvasScope | null = null
    let capturedCtx: SchedulerContext | null = null

    const OverlayProbe = defineComponent({
      setup() {
        capturedCtx = useScheduler()
        return () => h('div', { class: 'probe-ctx' }, String(capturedCtx!.tableWidth.value))
      },
    })

    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouScheduler,
            {
              modelValue: {
                version: 1,
                tasks: [
                  { id: 't1', title: '任务 1', resource: 'a', start: base, end: base + 60_000 },
                ],
                links: [],
              },
              resources: [{ id: 'a', title: 'Agent A' }],
              markers,
              scale: 'minute',
              calendar: false,
              tableWidth: 240,
              railHeight: 40,
            },
            {
              'rail-header': ({ width, height }: { width: number; height: number }) =>
                h('div', { class: 'rail-title' }, `${width}x${height}`),
              rail: (scope: SchedulerRailScope) => {
                capturedRail = scope
                return h('div', { class: 'rail-bars' })
              },
              underlay: () => h('div', { class: 'custom-underlay' }),
              overlay: (scope: SchedulerCanvasScope) => {
                capturedOverlay = scope
                return h(OverlayProbe)
              },
            },
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    // shaded bands render (full-height + row-scoped), and NOT as point events
    expect(wrapper.find('.dou-gantt__band.away-band').classes()).toContain('is-warning')
    expect(wrapper.find('.dou-gantt__band.is-row').classes()).toContain('is-primary')
    expect(wrapper.find('.dou-gantt__marker-label.is-band').text()).toBe('离开期间')
    expect(wrapper.findAll('.dou-gantt__event')).toHaveLength(0)

    // top auxiliary rail
    expect(wrapper.find('.dou-gantt__table-rail').attributes('style')).toContain('height: 40px')
    expect(wrapper.find('.rail-title').text()).toBe('240x40')
    expect(wrapper.find('.dou-gantt__rail .rail-bars').exists()).toBe(true)
    expect(capturedRail).not.toBeNull()
    expect(capturedRail!.height).toBe(40)
    expect(capturedRail!.xOf(base)).not.toBeNull()

    // underlay & overlay + useScheduler()
    expect(wrapper.find('.dou-gantt__layer.is-below .custom-underlay').exists()).toBe(true)
    expect(wrapper.find('.dou-gantt__layer.is-above .probe-ctx').text()).toBe('240')
    expect(capturedOverlay).not.toBeNull()
    expect(capturedOverlay!.rowBox('a')).not.toBeNull()
    expect(capturedOverlay!.barBox('t1')).not.toBeNull()
    expect(capturedCtx).not.toBeNull()
    expect(capturedCtx!.xOf(base)).toBeCloseTo(capturedOverlay!.xOf(base)!, 2)

    // clicking body track accounts for the 40px top rail offset (56 header + 40 rail = 96)
    const clicked: (string | null)[] = []
    wrapper.unmount()
    const railClickWrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouScheduler,
            {
              modelValue: { version: 1, tasks: [], links: [] },
              resources: [
                { id: 'r1', title: 'Row 1' },
                { id: 'r2', title: 'Row 2' },
              ],
              readonly: true,
              railHeight: 40,
              onResourceClick: (res: SchedulerResource | null) => clicked.push(res?.id ?? null),
            },
            {
              rail: () => h('div'),
            },
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()
    const body = railClickWrapper.find('.dou-gantt__body').element
    // y = 56 + 40 + 50 => body y = 50 => hits second row 'r2' (36..72), NOT 'r1' (0..36)
    body.dispatchEvent(
      new MouseEvent('click', { clientX: 300, clientY: 56 + 40 + 50, bubbles: true }),
    )
    expect(clicked).toEqual(['r2'])
    railClickWrapper.unmount()
  })

  it('selects the unassigned row with empty string key when clicked', async () => {
    const selectedResource = ref<string | null>(null)
    const clicked: (SchedulerResource | null)[] = []
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouScheduler, {
            modelValue: {
              version: 1,
              tasks: [{ id: 'u1', title: '未分配任务', start: '2026-03-02', end: '2026-03-04' }],
              links: [],
            },
            resources: [{ id: 'a', title: 'Agent A' }],
            readonly: true,
            selectedResource: selectedResource.value,
            'onUpdate:selectedResource': (id: string | null) => (selectedResource.value = id),
            onResourceClick: (res: SchedulerResource | null) => clicked.push(res),
          }),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    const rows = wrapper.findAll('.dou-gantt__tr')
    expect(rows).toHaveLength(2)
    await rows[1]!.trigger('click')
    await nextTick()

    expect(selectedResource.value).toBe('')
    expect(clicked).toEqual([null])
    expect(wrapper.findAll('.dou-gantt__tr')[1]!.classes()).toContain('is-selected')
    expect(wrapper.findAll('.dou-gantt__lane-row')[1]!.classes()).toContain('is-selected')

    // clicking the empty track of the unassigned row also emits ''
    selectedResource.value = 'a'
    await nextTick()
    const body = wrapper.find('.dou-gantt__body').element
    // header 56 + row0 (36) + middle of row1 (+18) = 110
    body.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 56 + 54, bubbles: true }))
    await nextTick()
    expect(selectedResource.value).toBe('')
    expect(clicked).toEqual([null, null])
    wrapper.unmount()
  })

  it('updates rail height and body coordinate mapping when #rail slot toggles dynamically', async () => {
    const showRail = ref(false)
    let latestRailScope: SchedulerRailScope | null = null
    const clicked: (string | null)[] = []

    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouScheduler,
            {
              modelValue: { version: 1, tasks: [], links: [] },
              resources: [
                { id: 'r1', title: 'Row 1' },
                { id: 'r2', title: 'Row 2' },
              ],
              readonly: true,
              railHeight: 40,
              onResourceClick: (res: SchedulerResource | null) => clicked.push(res?.id ?? null),
            },
            showRail.value
              ? {
                  rail: (scope: SchedulerRailScope) => {
                    latestRailScope = scope
                    return h('div', { class: 'dynamic-rail' })
                  },
                }
              : {},
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()

    // initially without #rail: headerHeight is 56, so y = 56 + 18 hits r1
    expect(wrapper.find('.dou-gantt__rail').exists()).toBe(false)
    const body = wrapper.find('.dou-gantt__body').element
    body.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 56 + 18, bubbles: true }))
    expect(clicked).toEqual(['r1'])

    // mount #rail dynamically: rail gets height 40px and headerHeight becomes 96
    showRail.value = true
    await nextTick()
    expect(wrapper.find('.dou-gantt__rail').exists()).toBe(true)
    expect(wrapper.find('.dou-gantt__rail').attributes('style')).toContain('height: 40px')
    expect(latestRailScope).not.toBeNull()
    expect(latestRailScope!.height).toBe(40)
    // y = 56 + 40 + 50 => body y = 50 => hits r2 (36..72)
    body.dispatchEvent(
      new MouseEvent('click', { clientX: 300, clientY: 56 + 40 + 50, bubbles: true }),
    )
    expect(clicked).toEqual(['r1', 'r2'])

    // unmount #rail dynamically: rail disappears and headerHeight returns to 56
    showRail.value = false
    await nextTick()
    expect(wrapper.find('.dou-gantt__rail').exists()).toBe(false)
    // y = 56 + 18 => body y = 18 => hits r1 again (would be negative if stale headerHeight stayed 96)
    body.dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 56 + 18, bubbles: true }))
    expect(clicked).toEqual(['r1', 'r2', 'r1'])
    wrapper.unmount()
  })
})
