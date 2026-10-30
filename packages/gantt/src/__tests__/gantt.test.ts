import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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
          selection: selection.value,
          'onUpdate:selection': (value: string[]) => (selection.value = value),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  return { wrapper, tasks, selection }
}

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
    const { wrapper } = setup({ columns: [{ key: 'title' }, { key: 'owner', label: '负责人' }] })
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__th').map((th) => th.text())).toEqual(['任务', '负责人'])
    wrapper.unmount()
    const hidden = setup({ table: false })
    await nextTick()
    expect(hidden.wrapper.find('.dou-gantt__table').exists()).toBe(false)
    expect(hidden.wrapper.findAll('.dou-gantt__bar').length).toBe(4)
    hidden.wrapper.unmount()
  })
})
