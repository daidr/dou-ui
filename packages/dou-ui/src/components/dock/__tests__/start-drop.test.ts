import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DouDock } from '../../../index'
import type * as TabDrag from '../../tabs/tab-drag'
import type { StartTabDragOptions } from '../../tabs/tab-drag'

const pressed: StartTabDragOptions[] = []
vi.mock('../../tabs/tab-drag', async (original) => ({
  ...(await original<typeof TabDrag>()),
  pressTab: (_event: PointerEvent, options: StartTabDragOptions) => pressed.push(options),
}))

const make = (props: Record<string, unknown> = {}) =>
  mount(DouDock, {
    props: {
      modelValue: { type: 'group', id: 'a', tabs: ['thread', 'plan'] },
      panels: [
        { value: 'thread', label: '需求讨论' },
        { value: 'plan', label: '发布计划' },
        { value: 'api', label: '接口文档' },
        { value: 'off', label: '归档', disabled: true },
        { value: 'fixed', label: '置顶', draggable: false },
        { value: 'files', label: '文件', pinned: true },
      ],
      ...props,
    },
    attachTo: document.body,
  })

const press = (el: Element, init: PointerEventInit = {}) => {
  const event = new PointerEvent('pointerdown', { button: 0, ...init })
  Object.defineProperty(event, 'target', { value: el })
  return event
}

afterEach(() => {
  pressed.length = 0
  document.body.innerHTML = ''
})

describe('DouDock startDrop', () => {
  it('drags a new value from nowhere, and an open one from its place', async () => {
    const wrapper = make()
    await nextTick()
    const item = document.createElement('button')
    document.body.append(item)
    // `currentTarget` is gone after an `await`: the element pressed is used
    wrapper.vm.startDrop(press(item, { clientX: 10, clientY: 10 }), { value: 'api' })
    wrapper.vm.startDrop(press(item, { clientX: 40, clientY: 10 }), {
      value: 'plan',
      label: '计划',
    })
    wrapper.vm.startDrop(press(item, { clientX: 80, clientY: 10 }), { value: 'files' })
    expect(pressed.map((options) => options.el)).toEqual([item, item, item])
    expect(pressed[0]!.drag()).toMatchObject({
      value: 'api',
      label: '接口文档',
      name: undefined,
      pinned: false,
    })
    // dropped back where it is, a row of tabs leaves it there
    expect(pressed[1]!.drag()).toMatchObject({
      value: 'plan',
      label: '计划',
      name: 'a',
      index: 1,
      pinned: false,
    })
    expect(pressed[2]!.drag()).toMatchObject({
      value: 'files',
      label: '文件',
      name: undefined,
      pinned: true,
    })
    wrapper.unmount()
  })

  it('does nothing for a disabled or fixed panel, or with dragging off', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = make()
    const item = document.createElement('a')
    wrapper.vm.startDrop(press(item), { value: 'off' })
    wrapper.vm.startDrop(press(item), { value: 'fixed' })
    expect(pressed).toHaveLength(0)
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('disabled'),
      expect.stringContaining('not draggable'),
    ])
    await wrapper.setProps({ draggable: false })
    wrapper.vm.startDrop(press(item), { value: 'api' })
    expect(pressed).toHaveLength(0)
    warn.mockRestore()
    wrapper.unmount()
  })

  it('keeps the browser from dragging the element, and swallows the click after a drag', async () => {
    const wrapper = make()
    const item = document.createElement('a')
    item.href = '#x'
    document.body.append(item)
    const clicks = vi.fn<() => void>()
    item.addEventListener('click', clicks)
    wrapper.vm.startDrop(press(item), { value: 'api' })
    const native = new Event('dragstart', { cancelable: true })
    item.dispatchEvent(native)
    expect(native.defaultPrevented).toBe(true)
    pressed[0]!.onStart?.()
    window.dispatchEvent(new PointerEvent('pointerup'))
    pressed[0]!.onEnd?.(true)
    item.click()
    expect(clicks).not.toHaveBeenCalled()
    // once the press is over, the element is left as it was
    const later = new Event('dragstart', { cancelable: true })
    item.dispatchEvent(later)
    expect(later.defaultPrevented).toBe(false)
    await new Promise((resolve) => setTimeout(resolve))
    item.click()
    expect(clicks).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('ignores modifier-key presses and non-primary buttons without blocking native drag', () => {
    const wrapper = make()
    const item = document.createElement('a')
    document.body.append(item)
    const modifiers: PointerEventInit[] = [
      { button: 2 },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
    ]
    for (const init of modifiers) {
      wrapper.vm.startDrop(press(item, init), { value: 'api' })
    }
    expect(pressed).toHaveLength(0)
    const native = new Event('dragstart', { cancelable: true })
    item.dispatchEvent(native)
    expect(native.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('ignores rapid repeat presses (double/triple click text selection) and detail > 1', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1000)
      const wrapper = make()
      const item = document.createElement('a')
      document.body.append(item)

      // first click at (50, 50) starts press tracking
      wrapper.vm.startDrop(press(item, { clientX: 50, clientY: 50 }), { value: 'api' })
      expect(pressed).toHaveLength(1)
      window.dispatchEvent(new PointerEvent('pointerup'))

      // second click within 400ms & 8px (double-click word select) is ignored
      vi.advanceTimersByTime(180)
      wrapper.vm.startDrop(press(item, { clientX: 53, clientY: 52 }), { value: 'api' })
      expect(pressed).toHaveLength(1)
      const native = new Event('dragstart', { cancelable: true })
      item.dispatchEvent(native)
      expect(native.defaultPrevented).toBe(false)

      // third click within 400ms of second click (triple-click sentence select) is also ignored
      vi.advanceTimersByTime(250)
      wrapper.vm.startDrop(press(item, { clientX: 51, clientY: 51 }), { value: 'api' })
      expect(pressed).toHaveLength(1)

      // once > 400ms passes, a normal press works again
      vi.advanceTimersByTime(450)
      wrapper.vm.startDrop(press(item, { clientX: 51, clientY: 51 }), { value: 'api' })
      expect(pressed).toHaveLength(2)

      // moving > 8px away works immediately even within 400ms
      vi.advanceTimersByTime(100)
      wrapper.vm.startDrop(press(item, { clientX: 70, clientY: 51 }), { value: 'api' })
      expect(pressed).toHaveLength(3)

      // explicit multi-click detail > 1 is also ignored
      vi.advanceTimersByTime(500)
      wrapper.vm.startDrop(press(item, { clientX: 120, clientY: 51, detail: 2 }), { value: 'api' })
      expect(pressed).toHaveLength(3)

      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
