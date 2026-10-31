import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { defineGanttExtension, useGantt } from '../index'
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

// a pointer on a table row, at a height in px
const at = (type: string, y: number, el: EventTarget = window) =>
  el.dispatchEvent(
    new PointerEvent(type, { button: 0, clientX: 40, clientY: y, pointerId: 2, bubbles: true }),
  )

// each press in its own tick, as from a person: the bound v-model catches up in between
const pressKey = async (el: Element, key: string, init: KeyboardEventInit = {}) => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  await nextTick()
}
const live = (wrapper: { find: (selector: string) => { text: () => string } }) =>
  wrapper.find('[aria-live]').text()

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

  it('walks the rows and moves a task with keys, as one undo step', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const root = wrapper.find('.dou-gantt').element
    await pressKey(root, 'ArrowDown')
    await pressKey(root, 'ArrowDown')
    await nextTick()
    expect(document.activeElement?.getAttribute('data-task')).toBe('a')
    await pressKey(root, 'ArrowRight', { altKey: true })
    await pressKey(root, 'ArrowRight', { altKey: true })
    // two working days later, still five working days long
    expect(tasks.value[1]).toMatchObject({ start: '2026-03-04', end: '2026-03-10' })
    await nextTick()
    await nextTick()
    expect(live(wrapper)).toContain('设计')
    await pressKey(root, 'ArrowRight', { altKey: true, shiftKey: true })
    expect(tasks.value[1]!.end).toBe('2026-03-11')
    const mod = /mac/i.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
    await pressKey(root, 'z', mod)
    await pressKey(root, 'z', mod)
    expect(tasks.value[1]).toMatchObject({ start: '2026-03-02', end: '2026-03-06' })
    wrapper.unmount()
  })

  it('folds a summary with Left and links two tasks with L', async () => {
    const { wrapper, tasks, links } = setup()
    await nextTick()
    const root = wrapper.find('.dou-gantt').element
    await pressKey(root, 'ArrowDown')
    await pressKey(root, 'ArrowLeft')
    expect(tasks.value[0]!.collapsed).toBe(true)
    await pressKey(root, 'ArrowRight')
    await nextTick()
    await pressKey(root, 'ArrowDown')
    await pressKey(root, 'l')
    // 设计 already leads to 开发, so that one is refused; 上线 is next
    await pressKey(root, 'ArrowDown')
    await nextTick()
    expect(wrapper.find('.dou-gantt__bar[data-task="b"]').classes()).toContain('is-link-refused')
    await pressKey(root, 'Enter')
    expect(links.value).toHaveLength(2)
    await pressKey(root, 'ArrowDown')
    await pressKey(root, 'Enter')
    expect(links.value.at(-1)).toMatchObject({ from: 'a', to: 'm' })
    await nextTick()
    await nextTick()
    expect(live(wrapper)).toContain('设计 → 上线')
    wrapper.unmount()
  })

  it('asks can-move and says why it refuses', async () => {
    const { wrapper, tasks } = setup({
      canMove: (move: { start: string }) => move.start >= '2026-03-02' || '不能早于 3 月 2 日',
    })
    await nextTick()
    const root = wrapper.find('.dou-gantt').element
    await pressKey(root, 'ArrowDown')
    await pressKey(root, 'ArrowDown')
    await pressKey(root, 'ArrowLeft', { altKey: true })
    expect(tasks.value[1]!.start).toBe('2026-03-02')
    await nextTick()
    await nextTick()
    expect(live(wrapper)).toBe('不能早于 3 月 2 日')
    wrapper.unmount()
  })

  it('takes columns, keys, markers and layers from extensions', async () => {
    const pressed: string[] = []
    const Layer = defineComponent(() => {
      const gantt = useGantt()
      return () => h('i', { class: 'test-layer', style: { left: `${gantt.xOf('2026-03-09')}px` } })
    })
    const owner = defineGanttExtension({
      name: 'owner',
      columns: [{ key: 'owner', title: '负责人', value: () => '戴兜' }],
      keymap: () => ({
        'shift+d': () => {
          pressed.push('d')
        },
        arrowdown: () => false,
      }),
      markers: () => [{ date: '2026-03-13', label: '冻结', tone: 'warning' }],
      layers: { below: [Layer] },
    })
    const { wrapper } = setup({
      extensions: [owner],
      markers: [{ date: '2026-03-16', label: '发布' }],
    })
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__th').map((th) => th.text())).toContain('负责人')
    expect(wrapper.findAll('.dou-gantt__marker-label').map((el) => el.text())).toEqual([
      '发布',
      '冻结',
    ])
    expect(wrapper.find('.dou-gantt__marker.is-warning').exists()).toBe(true)
    expect(wrapper.find('.test-layer').exists()).toBe(true)
    const root = wrapper.find('.dou-gantt').element
    await pressKey(root, 'D', { shiftKey: true })
    expect(pressed).toEqual(['d'])
    // a handler that returns false lets the chart's own key through
    await pressKey(root, 'ArrowDown')
    await nextTick()
    expect(wrapper.find('.dou-gantt__tr.is-active').exists()).toBe(true)
    wrapper.unmount()
  })
  it('pushes waiting tasks with automatic scheduling, previewed while dragging, undone as one', async () => {
    const { wrapper, tasks } = setup({ scheduling: 'auto' })
    await nextTick()
    press(wrapper.find('.dou-gantt__bar[data-task="a"]').element, 100)
    pointer('pointermove', 110)
    pointer('pointermove', 183)
    await nextTick()
    // dashed outlines where b and the milestone will go
    expect(wrapper.findAll('.dou-gantt__ghost')).toHaveLength(2)
    pointer('pointerup', 183)
    expect(tasks.value[1]).toMatchObject({ start: '2026-03-04', end: '2026-03-10' })
    expect(tasks.value[2]).toMatchObject({ start: '2026-03-11', end: '2026-03-17' })
    expect(tasks.value[3]).toMatchObject({ start: '2026-03-17' })
    await vi.waitFor(() => expect(live(wrapper)).toContain('另有 2 个任务随之推后'))
    const mod = /mac/i.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
    await pressKey(wrapper.find('.dou-gantt').element, 'z', mod)
    expect(tasks.value.slice(1).map((task) => task.start)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ])
    await vi.waitFor(() => expect(live(wrapper)).toContain('已撤销：设计'))
    wrapper.unmount()
  })

  it('dashes broken links, skips days off with keys, and schedules on request', async () => {
    const { wrapper, tasks } = setup({ critical: true })
    await nextTick()
    const root = wrapper.find('.dou-gantt').element
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) await pressKey(root, key)
    // a step back from Monday lands on Sunday, so it goes on to Friday
    await pressKey(root, 'ArrowLeft', { altKey: true })
    expect(tasks.value[2]).toMatchObject({ start: '2026-03-06', end: '2026-03-12' })
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__link.is-broken')).toHaveLength(1)
    await vi.waitFor(() => expect(live(wrapper)).toContain('1 条依赖未满足'))
    const gantt = wrapper.findComponent(DouGantt).vm
    const result = gantt.schedule({ pull: true })
    expect([...result.moves.keys()]).toEqual(['b', 'm'])
    expect(tasks.value[2]).toMatchObject({ start: '2026-03-09', end: '2026-03-13' })
    expect(tasks.value[3]!.start).toBe('2026-03-13')
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__link.is-broken')).toHaveLength(0)
    // back to back from start to finish: everything is critical
    expect(wrapper.findAll('.dou-gantt__bar.is-critical')).toHaveLength(3)
    expect(wrapper.findAll('.dou-gantt__link.is-critical')).toHaveLength(2)
    wrapper.unmount()
  })
  it('moves rows by dragging: between rows, or inside one', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const rowAt = (id: string) => wrapper.find(`.dou-gantt__tr[data-row="${id}"]`).element
    // the milestone, dropped on the top edge of 设计 (row 1)
    at('pointerdown', 3 * 36 + 18, rowAt('m'))
    at('pointermove', 100)
    at('pointermove', 36 + 4)
    await nextTick()
    expect(wrapper.find('.dou-gantt__drop-line').exists()).toBe(true)
    at('pointerup', 36 + 4)
    await nextTick()
    expect(wrapper.findAll('.dou-gantt__tr').map((row) => row.attributes('data-row'))).toEqual([
      'p',
      'm',
      'a',
      'b',
    ])
    // 开发 dropped on the middle of 设计: its subtask
    at('pointerdown', 3 * 36 + 18, rowAt('b'))
    at('pointermove', 100)
    at('pointermove', 2 * 36 + 18)
    await nextTick()
    expect(wrapper.find('.dou-gantt__tr.is-drop-inside').attributes('data-row')).toBe('a')
    at('pointerup', 2 * 36 + 18)
    expect(tasks.value.find((task) => task.id === 'b')!.parent).toBe('a')
    wrapper.unmount()
  })

  it('edits cells, indents with keys and adds tasks from the last row', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const root = wrapper.find('.dou-gantt').element
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) await pressKey(root, key)
    await pressKey(root, 'F2')
    const input = wrapper.find<HTMLInputElement>('.dou-gantt__editor-input')
    expect(input.element.value).toBe('开发')
    await input.setValue('开发与联调')
    await input.trigger('keydown', { key: 'Enter' })
    expect(tasks.value[2]!.title).toBe('开发与联调')
    // the duration cell: seven working days from Monday
    await wrapper.findAll('.dou-gantt__tr')[2]!.findAll('.dou-gantt__td')[2]!.trigger('dblclick')
    const days = wrapper.find<HTMLInputElement>('.dou-gantt__editor-input')
    await days.setValue('7')
    await days.trigger('keydown', { key: 'Enter' })
    expect(tasks.value[2]).toMatchObject({ start: '2026-03-09', end: '2026-03-17' })
    // a summary's dates can't be edited
    await wrapper.findAll('.dou-gantt__tr')[0]!.findAll('.dou-gantt__td')[1]!.trigger('dblclick')
    expect(wrapper.find('.dou-gantt__editor').exists()).toBe(false)

    await pressKey(root, ']', { ctrlKey: true, metaKey: /mac/i.test(navigator.platform) })
    expect(tasks.value.find((task) => task.id === 'b')!.parent).toBe('a')
    await pressKey(root, '[', { ctrlKey: true, metaKey: /mac/i.test(navigator.platform) })
    expect(tasks.value.find((task) => task.id === 'b')!.parent).toBe('p')

    await wrapper.find('.dou-gantt__add').trigger('click')
    const add = wrapper.find<HTMLInputElement>('.dou-gantt__add-row input')
    await add.setValue('复盘')
    await add.trigger('keydown', { key: 'Enter' })
    expect(tasks.value.at(-1)).toMatchObject({ title: '复盘' })
    expect(tasks.value.at(-1)!.parent).toBeUndefined()
    wrapper.unmount()
  })

  it('opens a menu with the extensions’ items before the built-in ones', async () => {
    const run = vi.fn<(id: string) => void>()
    const extension = defineGanttExtension({
      name: 'details',
      contextMenu: (_, target) =>
        target.kind === 'task'
          ? [{ key: 'details', label: '详情', run: () => run(target.task.id) }]
          : [],
    })
    const { wrapper } = setup({ extensions: [extension] })
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
    wrapper.unmount()
  })
})
