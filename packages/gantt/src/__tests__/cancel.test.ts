import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { defineGanttExtension, DouGantt, type GanttTask, type GanttTransaction } from '../index'
import type { GanttExpose } from '../types'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('cancelling a change', () => {
  it('lets an extension cancel a change, with a reason shown and read out', async () => {
    const tasks = ref<GanttTask[]>([
      { id: 'a', title: '需求评审', start: '2026-11-02', end: '2026-11-04' },
      { id: 'b', title: '上线', start: '2026-11-05', end: '2026-11-06' },
    ])
    const cancels: GanttTransaction[] = []
    const seen: GanttTransaction[] = []
    const guard = defineGanttExtension({
      name: 'guard',
      transaction: (tr) => {
        if (tr.steps.some((step) => step.type === 'updateTask' && step.id === 'b'))
          tr.cancel('上线日期由发布系统决定')
      },
    })
    const gantt = ref<GanttExpose>()
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouGantt, {
            ref: gantt,
            tasks: tasks.value,
            'onUpdate:tasks': (value: GanttTask[]) => (tasks.value = value),
            extensions: [guard],
            onTransactionCancel: (tr: GanttTransaction) => cancels.push(tr),
            onTransaction: (tr: GanttTransaction) => seen.push(tr),
          }),
      ),
      { attachTo: document.body },
    )
    const tr = gantt.value!.transact((t) => t.updateTask('b', { end: '2026-11-08' }))
    await nextTick()
    expect(tr.cancelled).toBe(true)
    expect(tr.changed).toBe(false)
    expect(tasks.value[1]!.end).toBe('2026-11-06')
    expect(cancels).toEqual([tr])
    expect(seen).toEqual([])
    expect(gantt.value!.canUndo).toBe(false)
    expect(wrapper.find('.dou-gantt__notice').text()).toBe('上线日期由发布系统决定')
    await nextTick()
    expect(wrapper.find('[aria-live]').text()).toBe('上线日期由发布系统决定')
    // others go ahead
    gantt.value!.transact((t) => t.updateTask('a', { end: '2026-11-05' }))
    expect(tasks.value[0]!.end).toBe('2026-11-05')
  })
})
