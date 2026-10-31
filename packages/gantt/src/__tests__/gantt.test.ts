import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouGantt } from '../index'
import type { GanttLink, GanttTask } from '../index'

const sample = (): GanttTask[] => [
  { id: 'p', title: '发布' },
  { id: 'a', parent: 'p', title: '设计', start: '2026-03-02', end: '2026-03-06', progress: 0.5 },
  { id: 'b', parent: 'p', title: '开发', start: '2026-03-09', end: '2026-03-13' },
  { id: 'm', parent: 'p', title: '上线', type: 'milestone', start: '2026-03-16' },
]

function setup(extra: Record<string, unknown> = {}) {
  const tasks = ref(sample())
  const links = ref<GanttLink[]>([
    { id: 'l1', from: 'a', to: 'b' },
    { id: 'l2', from: 'b', to: 'm' },
  ])
  const selection = ref<string[]>([])
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouGantt, {
          tasks: tasks.value,
          'onUpdate:tasks': (value: GanttTask[]) => (tasks.value = value),
          links: links.value,
          'onUpdate:links': (value: GanttLink[]) => (links.value = value),
          selection: selection.value,
          'onUpdate:selection': (value: string[]) => (selection.value = value),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  return { wrapper, tasks, links, selection }
}

// happy-dom lays nothing out: the chart sits at 0 and a day is 40px wide
const press = (el: Element, clientX: number) =>
  el.dispatchEvent(
    new PointerEvent('pointerdown', {
      button: 0,
      clientX,
      clientY: 10,
      pointerId: 1,
      bubbles: true,
    }),
  )
const pointer = (type: string, clientX: number) =>
  window.dispatchEvent(new PointerEvent(type, { clientX, clientY: 10, pointerId: 1 }))

describe('DouGantt', () => {
  it('renders the table with summaries worked out', async () => {
    const { wrapper } = setup()
    await nextTick()
    const rows = wrapper.findAll('.dou-gantt__tr')
    expect(rows.map((row) => row.find('.is-title .dou-gantt__cell-text').text())).toEqual([
      '发布',
      '设计',
      '开发',
      '上线',
    ])
    // the summary covers its children: 3/2 to 3/16, eleven working days
    expect(rows[0]!.findAll('.dou-gantt__td')[2]!.text()).toBe('11 天')
    expect(rows[1]!.attributes('aria-level')).toBe('2')
    wrapper.unmount()
  })

  it('draws bars, a milestone and dependency lines', async () => {
    const { wrapper } = setup()
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__bar').length).toBe(4)
    expect(wrapper.find('.dou-gantt__bar.is-milestone').exists()).toBe(true)
    expect(wrapper.find('.dou-gantt__bar.is-summary').exists()).toBe(true)
    expect(wrapper.findAll('.dou-gantt__link').length).toBe(2)
    expect(wrapper.find('.dou-gantt__bar[aria-label^="设计"]').attributes('aria-label')).toContain(
      '进度 50%',
    )
    wrapper.unmount()
  })

  it('collapses a summary through v-model:tasks', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    await wrapper.find('.dou-gantt__toggle').trigger('click')
    expect(tasks.value[0]!.collapsed).toBe(true)
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__tr').length).toBe(1)
    expect(wrapper.findAll('.dou-gantt__link').length).toBe(0)
    wrapper.unmount()
  })

  it('selects by click and adds with Shift', async () => {
    const { wrapper, selection } = setup()
    await nextTick()
    const rows = wrapper.findAll('.dou-gantt__tr')
    await rows[1]!.trigger('click')
    expect(selection.value).toEqual(['a'])
    await rows[2]!.trigger('click', { shiftKey: true })
    expect(selection.value).toEqual(['a', 'b'])
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__bar.is-selected').length).toBe(2)
    wrapper.unmount()
  })

  it('reads columns from data and hides the table on request', async () => {
    const { wrapper } = setup({
      columns: [
        { key: 'title' },
        {
          key: 'owner',
          title: '负责人',
          value: (task: GanttTask) => (task.id === 'a' ? '戴兜' : ''),
        },
      ],
    })
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__th').map((th) => th.text())).toEqual(['任务', '负责人'])
    expect(wrapper.findAll('.dou-gantt__tr')[1]!.findAll('.dou-gantt__td')[1]!.text()).toBe('戴兜')
    wrapper.unmount()
    const hidden = setup({ table: false })
    await nextTick()
    expect(hidden.wrapper.find('.dou-gantt__table').exists()).toBe(false)
    expect(hidden.wrapper.findAll('.dou-gantt__bar').length).toBe(4)
    hidden.wrapper.unmount()
  })

  it('warns once about dates it can’t read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper, tasks } = setup()
    tasks.value = [...tasks.value, { id: 'x', title: '手写', start: '2026-3-5' }]
    await nextTick()
    tasks.value = [...tasks.value]
    await nextTick()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('"x"')
    warn.mockRestore()
    wrapper.unmount()
  })

  it('moves a bar by whole days, as one undo step', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    press(wrapper.find('.dou-gantt__bar[data-task="a"]').element, 100)
    pointer('pointermove', 110)
    pointer('pointermove', 183)
    await nextTick()
    // while dragging, the table already shows the new start
    expect(wrapper.findAll('.dou-gantt__tr')[1]!.findAll('.dou-gantt__td')[1]!.text()).toBe(
      '3月4日',
    )
    expect(tasks.value[1]!.start).toBe('2026-03-02')
    pointer('pointerup', 183)
    // five working days still: the bar now spans the weekend
    expect(tasks.value[1]).toMatchObject({ start: '2026-03-04', end: '2026-03-10' })
    // undo right away, before the parent has rendered the change
    const mod = /mac/i.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
    wrapper
      .find('.dou-gantt')
      .element.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ...mod, bubbles: true }))
    expect(tasks.value[1]).toMatchObject({ start: '2026-03-02', end: '2026-03-06' })
    wrapper.unmount()
  })

  it('resizes the end and drags the progress', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    press(wrapper.find('[data-handle="end"]').element, 300)
    pointer('pointermove', 340)
    pointer('pointerup', 340)
    expect(tasks.value[1]).toMatchObject({ start: '2026-03-02', end: '2026-03-07' })
    await nextTick()
    const bar = wrapper.find('.dou-gantt__bar[data-task="a"]').element as HTMLElement
    // bar positions are in timeline px; the pointer is on screen
    const left =
      Number.parseFloat(bar.style.left) - wrapper.find('.dou-gantt__chart').element.scrollLeft
    press(wrapper.find('[data-handle="progress"]').element, left + 60)
    pointer('pointermove', left + 120)
    pointer('pointerup', left + 120)
    // 120 of 240px
    expect(tasks.value[1]!.progress).toBe(0.5)
    wrapper.unmount()
  })

  it('cancels a drag with Escape and ignores it when read-only', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    press(wrapper.find('.dou-gantt__bar[data-task="a"]').element, 100)
    pointer('pointermove', 260)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    pointer('pointerup', 260)
    expect(tasks.value[1]!.start).toBe('2026-03-02')
    wrapper.unmount()
    const ro = setup({ readonly: true })
    await nextTick()
    expect(ro.wrapper.find('[data-handle]').exists()).toBe(false)
    press(ro.wrapper.find('.dou-gantt__bar[data-task="a"]').element, 100)
    pointer('pointermove', 260)
    pointer('pointerup', 260)
    expect(ro.tasks.value[1]!.start).toBe('2026-03-02')
    ro.wrapper.unmount()
  })

  it('deletes a selected link with Delete', async () => {
    const { wrapper, links } = setup()
    await nextTick()
    await wrapper.find('.dou-gantt__link').trigger('click')
    await wrapper.find('.dou-gantt').trigger('keydown', { key: 'Delete' })
    expect(links.value.map((link) => link.id)).toEqual(['l2'])
    wrapper.unmount()
  })
})
