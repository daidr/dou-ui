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
        { value: 'pinned', label: '置顶', draggable: false },
      ],
      ...props,
    },
    attachTo: document.body,
  })

const press = (el: Element) => {
  const event = new PointerEvent('pointerdown', { button: 0 })
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
    wrapper.vm.startDrop(press(item), { value: 'api' })
    wrapper.vm.startDrop(press(item), { value: 'plan', label: '计划' })
    expect(pressed.map((options) => options.el)).toEqual([item, item])
    expect(pressed[0]!.drag()).toMatchObject({ value: 'api', label: '接口文档', name: undefined })
    // dropped back where it is, a row of tabs leaves it there
    expect(pressed[1]!.drag()).toMatchObject({ value: 'plan', label: '计划', name: 'a', index: 1 })
    wrapper.unmount()
  })

  it('does nothing for a disabled or fixed panel, or with dragging off', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = make()
    const item = document.createElement('a')
    wrapper.vm.startDrop(press(item), { value: 'off' })
    wrapper.vm.startDrop(press(item), { value: 'pinned' })
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
})
