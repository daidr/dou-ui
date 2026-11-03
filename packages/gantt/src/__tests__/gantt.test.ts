import { mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { defineGanttExtension, takeBaseline, useGantt } from '../index'
import { DouGantt } from '../index'
import type { GanttExpose, GanttMenuTarget, GanttTask } from '../index'
import { bind, planRef } from './plan-ref'

const sample = (): GanttTask[] => [
  { id: 'p', title: '发布' },
  { id: 'a', parent: 'p', title: '设计', start: '2026-03-02', end: '2026-03-06', progress: 0.5 },
  { id: 'b', parent: 'p', title: '开发', start: '2026-03-09', end: '2026-03-13' },
  { id: 'm', parent: 'p', title: '上线', type: 'milestone', start: '2026-03-16' },
]

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

function setup(extra: Record<string, unknown> = {}) {
  const { doc, tasks, links } = planRef(sample(), [
    { id: 'l1', from: 'a', to: 'b' },
    { id: 'l2', from: 'b', to: 'm' },
  ])
  const selection = ref<string[]>([])
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouGantt, {
          ...bind(doc),
          selection: selection.value,
          'onUpdate:selection': (value: string[]) => (selection.value = value),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  return { wrapper, doc, tasks, links, selection }
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

  it('collapses a summary through v-model', async () => {
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
    // a value that can't be read keeps the field open
    await wrapper.findAll('.dou-gantt__tr')[2]!.findAll('.dou-gantt__td')[2]!.trigger('dblclick')
    const wrong = wrapper.find<HTMLInputElement>('.dou-gantt__editor-input')
    await wrong.setValue('abc')
    await wrong.trigger('keydown', { key: 'Enter' })
    expect(wrong.attributes('aria-invalid')).toBe('true')
    expect(live(wrapper)).toBe('工期无效，未修改')
    await wrong.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.dou-gantt__editor').exists()).toBe(false)
    // a summary's dates can't be edited
    await wrapper.findAll('.dou-gantt__tr')[0]!.findAll('.dou-gantt__td')[1]!.trigger('dblclick')
    expect(wrapper.find('.dou-gantt__editor').exists()).toBe(false)

    await pressKey(root, ']', { ctrlKey: true, metaKey: /mac/i.test(navigator.platform) })
    expect(tasks.value.find((task) => task.id === 'b')!.parent).toBe('a')
    await nextTick()
    await nextTick()
    await nextTick()
    expect(live(wrapper)).toBe('开发与联调已移到设计下')
    await pressKey(root, '[', { ctrlKey: true, metaKey: /mac/i.test(navigator.platform) })
    expect(tasks.value.find((task) => task.id === 'b')!.parent).toBe('p')
    await nextTick()
    await nextTick()
    await nextTick()
    expect(live(wrapper)).toBe('开发与联调已移到发布下')

    await wrapper.find('.dou-gantt__add').trigger('click')
    const add = wrapper.find<HTMLInputElement>('.dou-gantt__add-row input')
    await add.setValue('复盘')
    await add.trigger('keydown', { key: 'Enter' })
    // it starts the working day after the last task, so it shows on the timeline
    expect(tasks.value.at(-1)).toMatchObject({
      title: '复盘',
      start: '2026-03-17',
      end: '2026-03-17',
    })
    expect(tasks.value.at(-1)!.parent).toBeUndefined()
    expect(live(wrapper)).toBe('已添加复盘')
    wrapper.unmount()
  })

  it('reads and writes columns of your own with parse and format', async () => {
    const columns = [
      { key: 'title' },
      {
        key: 'budget',
        editable: true,
        input: 'number' as const,
        parse: (text: string) => (text.trim() && Number.isFinite(+text) ? +text : undefined),
        format: (value: unknown) => (value == null ? '' : `¥${value}`),
      },
    ]
    const { wrapper, tasks } = setup({ columns })
    await nextTick()
    const cell = () => wrapper.findAll('.dou-gantt__tr')[1]!.findAll('.dou-gantt__td')[1]!
    await cell().trigger('dblclick')
    const input = wrapper.find<HTMLInputElement>('.dou-gantt__editor-input')
    expect(input.attributes('type')).toBe('number')
    await input.setValue('1200')
    await input.trigger('keydown', { key: 'Enter' })
    expect(tasks.value[1]!.data).toEqual({ budget: 1200 })
    expect(cell().text()).toBe('¥1200')
    await cell().trigger('dblclick')
    expect(wrapper.find<HTMLInputElement>('.dou-gantt__editor-input').element.value).toBe('1200')
    wrapper.unmount()
  })

  it('opens a menu with the extensions’ items before the built-in ones', async () => {
    const run = vi.fn<(id: string) => void>()
    const seen: string[] = []
    const extension = defineGanttExtension({
      name: 'details',
      contextMenu: (_, target) => {
        seen.push(target.kind)
        return target.kind === 'task'
          ? [{ key: 'details', label: '详情', run: () => run(target.task.id) }]
          : []
      },
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
    expect(seen).toEqual(['task'])
    wrapper.unmount()
  })

  it('opens the blank-space menu below the last row too', async () => {
    const seen: string[] = []
    const contextMenu = (target: GanttMenuTarget) => {
      seen.push(target.kind)
      return [{ key: 'here', label: '这里', run: () => {} }]
    }
    const { wrapper } = setup({ contextMenu })
    await nextTick()
    await wrapper.find('.dou-gantt__canvas').trigger('contextmenu')
    await nextTick()
    await nextTick()
    expect(seen).toEqual(['canvas'])
    expect(document.querySelector('[role="menuitem"]')?.textContent?.trim()).toBe('这里')
    wrapper.unmount()
  })

  it('takes menu items from a prop too, before the extensions’', async () => {
    const extension = defineGanttExtension({
      name: 'details',
      contextMenu: () => [{ key: 'details', label: '详情', run: () => {} }],
    })
    const copy = vi.fn<() => void>()
    const contextMenu = () => [{ key: 'copy', label: '复制', run: copy }]
    const { wrapper } = setup({ extensions: [extension], contextMenu })
    await nextTick()
    await wrapper.find('.dou-gantt__bar[data-task="a"]').trigger('contextmenu')
    await nextTick()
    await nextTick()
    const items = [...document.querySelectorAll('[role="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    )
    expect(items.slice(0, 2)).toEqual(['复制', '详情'])
    wrapper.unmount()
  })
})

describe('extension lifecycle', () => {
  it('sets up once when the list is written inline', async () => {
    let setups = 0
    const watcher = defineGanttExtension({ name: 'watcher', setup: () => void setups++ })
    const { doc, tasks } = planRef(sample())
    mount(
      defineComponent(
        () => () =>
          h(DouGantt, {
            ...bind(doc),
            // a new list on every render
            extensions: [watcher],
          }),
      ),
      { attachTo: document.body },
    )
    await nextTick()
    tasks.value = tasks.value.slice(1)
    await nextTick()
    tasks.value = tasks.value.slice(1)
    await nextTick()
    expect(setups).toBe(1)
  })

  it('warns once when the extensions keep being made anew', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { doc, tasks } = planRef(sample())
    mount(
      defineComponent(
        () => () =>
          h(DouGantt, {
            ...bind(doc),
            // a new extension on every render, as when made in the template
            extensions: [defineGanttExtension({ name: 'fresh', setup: () => {} })],
          }),
      ),
      { attachTo: document.body },
    )
    for (let i = 0; i < 6; i++) {
      tasks.value = tasks.value.map((task) => ({ ...task }))
      await nextTick()
    }
    const calls = warn.mock.calls.filter(([text]) => String(text).includes('set up again'))
    expect(calls).toHaveLength(1)
    warn.mockRestore()
  })
})

describe('baseline', () => {
  it('saves the current dates, summaries included', () => {
    expect(takeBaseline(sample())).toEqual([
      { id: 'p', start: '2026-03-02', end: '2026-03-16' },
      { id: 'a', start: '2026-03-02', end: '2026-03-06' },
      { id: 'b', start: '2026-03-09', end: '2026-03-13' },
      { id: 'm', start: '2026-03-16' },
    ])
  })

  it('draws the plan under the bars and reads out how far a task moved', async () => {
    const baseline = takeBaseline(sample()).map((item) =>
      item.id === 'b' ? { ...item, start: '2026-03-05', end: '2026-03-11' } : item,
    )
    const { wrapper } = setup({ baseline })
    await nextTick()
    expect(wrapper.find('.dou-gantt').classes()).toContain('has-baseline')
    expect(wrapper.findAll('.dou-gantt__baseline')).toHaveLength(4)
    expect(wrapper.find('.dou-gantt__baseline.is-milestone').exists()).toBe(true)
    // planned to end on 3/11, now ends on 3/13: two working days late
    expect(wrapper.find('.dou-gantt__bar[data-task="b"]').attributes('aria-label')).toMatch(
      /，比计划晚 2 天$/,
    )
    expect(wrapper.find('.dou-gantt__bar[data-task="a"]').attributes('aria-label')).not.toMatch(
      /计划/,
    )
  })

  it('puts a milestone plan under the milestone, turned after it is moved into place', async () => {
    const { wrapper } = setup({ baseline: takeBaseline(sample()) })
    await nextTick()
    const plan = wrapper.find('.dou-gantt__baseline.is-milestone').element as HTMLElement
    const bar = wrapper.find('.dou-gantt__bar[data-task="m"]').element as HTMLElement
    const row = bar.parentElement!
    const move = /^translate\(([\d.]+)px, ([\d.]+)px\) rotate\(45deg\)$/.exec(plan.style.transform)
    expect(move).not.toBeNull()
    expect(Number(move![1])).toBe(Number.parseFloat(bar.style.left))
    expect(Number(move![2])).toBe(Number(/translateY\(([\d.]+)px\)/.exec(row.style.transform)![1]))
  })
})

/** Whether a rect fills the whole drawing. */
const filled = (svg: string) => /<rect width="[\d.]+" height="[\d.]+" fill=/.test(svg)

describe('export', () => {
  it('writes the table as CSV, collapsed subtasks too', async () => {
    const { wrapper, tasks } = setup()
    tasks.value = tasks.value.map((task) => (task.id === 'p' ? { ...task, collapsed: true } : task))
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    const csv = vm.toCSV()
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      '任务,开始,工期（天）',
      '发布,2026-03-02,11',
      '设计,2026-03-02,5',
      '开发,2026-03-09,5',
      '上线,2026-03-16,',
    ])
    // with timed tasks too, each duration keeps its unit
    tasks.value = [
      ...tasks.value,
      { id: 't', title: '评审会', start: '2026-03-03 10:00', end: '2026-03-03 12:00' },
    ]
    await nextTick()
    expect(vm.toCSV({ bom: false }).split('\r\n').slice(-1)).toEqual([
      '评审会,2026-03-03 10:00,2 小时',
    ])
    expect(vm.toCSV({ bom: false }).split('\r\n')[0]).toBe('任务,开始,工期')
    tasks.value = tasks.value.filter((task) => task.id !== 't')
    await nextTick()
    expect(vm.toCSV({ text: true, bom: false }).split('\r\n')).toEqual([
      '任务,开始,工期',
      '发布,3月2日,11 天',
      '设计,3月2日,5 天',
      '开发,3月9日,5 天',
      '上线,3月16日,',
    ])
  })

  it('reads its own CSV back, with the tree when ids are written', async () => {
    const { wrapper } = setup({
      columns: [{ key: 'title' }, { key: 'start' }, { key: 'end' }, { key: 'progress' }],
    })
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    const csv = vm.toCSV({ ids: true })
    expect(csv.slice(1).split('\r\n')[0]).toBe('ID,上级任务 ID,任务,开始,结束,进度')
    const { tasks: read, warnings, unknownColumns } = vm.readCSV(csv)
    expect(warnings).toEqual([])
    expect(unknownColumns).toEqual([])
    // the summary's dates come from its subtasks again
    expect(read).toEqual([
      { id: 'p', title: '发布' },
      {
        id: 'a',
        parent: 'p',
        title: '设计',
        start: '2026-03-02',
        end: '2026-03-06',
        progress: 0.5,
      },
      { id: 'b', parent: 'p', title: '开发', start: '2026-03-09', end: '2026-03-13', progress: 0 },
      { id: 'm', parent: 'p', title: '上线', type: 'milestone', start: '2026-03-16' },
    ])
  })

  it('reads durations as working days or hours, as toCSV writes them', async () => {
    const { wrapper, tasks } = setup()
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    const plain = vm.readCSV(vm.toCSV())
    // without ids, the summary is a task of its own
    expect(plain.tasks.map(({ id: _id, ...task }) => task)).toEqual([
      { title: '发布', start: '2026-03-02', end: '2026-03-16' },
      { title: '设计', start: '2026-03-02', end: '2026-03-06' },
      { title: '开发', start: '2026-03-09', end: '2026-03-13' },
      { title: '上线', start: '2026-03-16', type: 'milestone' },
    ])
    tasks.value = [{ id: 't', title: '评审会', start: '2026-03-03 10:00', end: '2026-03-03 12:00' }]
    await nextTick()
    expect(vm.readCSV(vm.toCSV()).tasks[0]).toMatchObject({
      start: '2026-03-03 10:00',
      end: '2026-03-03 12:00',
    })
    expect(() => vm.readCSV('名称,日期\n一,2026-03-02')).toThrow(/title column/)
  })

  it('imports CSV as one undo step, keeping links of the tasks it has', async () => {
    const { wrapper, tasks, links } = setup()
    tasks.value = tasks.value.map((task) => (task.id === 'b' ? { ...task, tone: 'danger' } : task))
    const before = tasks.value
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    // moved in a spreadsheet: 开发 a week later and before 设计, 上线 gone, a new task added
    const csv = [
      'ID,上级任务 ID,任务,开始,工期（天）',
      'p,,发布,2026-03-02,11',
      'b,p,开发（二期）,2026-03-16,5',
      'a,p,设计,2026-03-02,5',
      ',p,验收,2026-03-23,2',
    ].join('\n')
    const result = vm.importCSV(csv)!
    expect(result.columns).toEqual(['id', 'parent', 'title', 'start', 'duration'])
    await nextTick()
    const b = tasks.value.find((task) => task.id === 'b')!
    expect(b).toMatchObject({
      title: '开发（二期）',
      start: '2026-03-16',
      end: '2026-03-20',
      tone: 'danger',
    })
    expect(tasks.value.find((task) => task.id === 'a')!.progress).toBe(0.5)
    expect(tasks.value.some((task) => task.id === 'm')).toBe(false)
    // the rows in the order of the file
    const rows = wrapper
      .findAll('.dou-gantt__tr')
      .map((row) => row.findAll('.dou-gantt__td')[0]!.text())
    expect(rows).toEqual(['发布', '开发（二期）', '设计', '验收'])
    expect(links.value).toEqual([{ id: 'l1', from: 'a', to: 'b' }])
    expect(vm.undo()).toBe(true)
    await nextTick()
    expect(tasks.value).toEqual(before)
    expect(links.value).toHaveLength(2)

    // appended, with new ids where theirs are taken, or under a task of the chart
    vm.importCSV(
      'ID,上级任务 ID,任务,开始,工期\np,,二期,2026-04-01,\nx,p,联调,2026-04-01,3\ny,a,补图,2026-03-09,1',
      { mode: 'append' },
    )
    await nextTick()
    expect(tasks.value).toHaveLength(7)
    const [copy, child, under] = tasks.value.slice(4)
    expect(copy!.id).not.toBe('p')
    expect(child).toMatchObject({ id: 'x', parent: copy!.id, title: '联调' })
    expect(under).toMatchObject({ id: 'y', parent: 'a' })
  })

  it('keeps text that looks like a formula from running in spreadsheets, and reads it back', async () => {
    const { wrapper, tasks } = setup()
    tasks.value = [
      { id: 'r', title: '-复盘', start: '2026-03-02' },
      { id: 'f', title: '=1+1', start: '2026-03-03' },
    ]
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    const csv = vm.toCSV({ bom: false, ids: true })
    expect(csv.split('\r\n').slice(1)).toEqual(["r,,'-复盘,2026-03-02,1", "f,,'=1+1,2026-03-03,1"])
    expect(vm.readCSV(csv).tasks.map((task) => task.title)).toEqual(['-复盘', '=1+1'])
    expect(vm.toCSV({ bom: false, escapeFormulas: false }).split('\r\n')[1]).toBe(
      '-复盘,2026-03-02,1',
    )
  })

  it('imports nothing while readonly', async () => {
    const { wrapper, tasks } = setup({ readonly: true })
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    expect(vm.importCSV('任务\n新任务')).toBeNull()
    expect(tasks.value).toEqual(sample())
    // reading changes nothing, so it still works
    expect(vm.readCSV('任务\n新任务').tasks).toHaveLength(1)
  })

  it('writes the end of a summary that ends on a milestone as its day', async () => {
    const { wrapper } = setup({ columns: [{ key: 'title' }, { key: 'end' }] })
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    // 发布 ends with 上线 on 03-16, as the table shows it
    expect(vm.toCSV({ bom: false }).split('\r\n')[1]).toBe('发布,2026-03-16')
  })

  it('draws the chart as SVG, with the plan under the bars', async () => {
    const baseline = [{ id: 'b', start: '2026-03-05', end: '2026-03-11' }]
    const { wrapper } = setup({ baseline })
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as {
      exportSVG: (options?: { table?: boolean; background?: boolean }) => string
    }
    const svg = vm.exportSVG({ table: true })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    for (const text of ['任务', '发布', '设计', '开发', '上线', '2026年3月'])
      expect(svg).toContain(`>${text}<`)
    // two links, each a line and an arrow
    expect(svg.match(/<path d="M/g)?.length).toBeGreaterThanOrEqual(4)
    expect(svg).toContain('height="4" rx="2"')
    // a parseable document
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    expect(doc.querySelector('parsererror')).toBeNull()
    // without a background, nothing fills the whole drawing
    expect(filled(svg)).toBe(true)
    expect(filled(vm.exportSVG({ table: true, background: false }))).toBe(false)
  })

  it('throws a RangeError when the PNG is too big for a canvas', async () => {
    const { wrapper, tasks } = setup()
    tasks.value = Array.from({ length: 1000 }, (_, i) => ({
      id: `t${i}`,
      title: `任务 ${i}`,
      start: '2026-03-02',
      end: '2026-03-06',
    }))
    await nextTick()
    const vm = wrapper.findComponent(DouGantt).vm as unknown as GanttExpose
    await expect(vm.exportPNG()).rejects.toThrow(RangeError)
  })
})
