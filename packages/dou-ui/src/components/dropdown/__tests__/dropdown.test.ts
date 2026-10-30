import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouDropdown, DouDropdownItem } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const items = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

function withModel(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouDropdown, {
    props: {
      open: false,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      ...props,
    },
    slots: {
      default: () => h('button', { id: 'trigger' }, '更多'),
      menu: () => [
        h(DouDropdownItem, { value: 'edit' }, () => '编辑'),
        h(DouDropdownItem, { value: 'copy', disabled: true }, () => '复制'),
        h(DouDropdownItem, { value: 'share' }, () => '分享'),
        h(DouDropdownItem, { value: 'delete', tone: 'danger', divided: true }, () => '删除'),
      ],
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('DouDropdown', () => {
  it('opens a menu from the trigger', async () => {
    const wrapper = withModel()
    const trigger = wrapper.get('#trigger')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const menu = document.querySelector('[role="menu"]')!
    expect(trigger.attributes('aria-controls')).toBe(menu.id)
    expect(items()).toHaveLength(4)
    expect(items()[1]!.getAttribute('aria-disabled')).toBe('true')
    expect(menu.querySelector('[role="separator"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('moves through enabled items with the keyboard and selects', async () => {
    const wrapper = withModel()
    key(wrapper.get('#trigger').element, 'ArrowDown')
    await nextTick()
    await nextTick()
    expect(document.activeElement?.textContent).toBe('编辑')

    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement?.textContent).toBe('分享')
    key(document.activeElement!, 'End')
    expect(document.activeElement?.textContent).toBe('删除')
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement?.textContent).toBe('编辑')
    key(document.activeElement!, 'ArrowUp')
    expect(document.activeElement?.textContent).toBe('删除')
    key(document.activeElement!, 's')
    expect(document.activeElement?.textContent).toBe('删除')

    key(document.activeElement!, 'Home')
    key(document.activeElement!, 'Enter')
    await nextTick()
    expect(wrapper.emitted('select')).toEqual([['edit']])
    expect(wrapper.props('open')).toBe(false)
    expect(document.activeElement?.id).toBe('trigger')
    wrapper.unmount()
  })

  it('opens at the last item with ArrowUp', async () => {
    const wrapper = withModel()
    key(wrapper.get('#trigger').element, 'ArrowUp')
    await nextTick()
    await nextTick()
    expect(document.activeElement?.textContent).toBe('删除')
    wrapper.unmount()
  })

  it('ignores disabled items and can stay open after a choice', async () => {
    const wrapper = withModel({ open: true, hideOnSelect: false })
    await nextTick()
    items()[1]!.click()
    expect(wrapper.emitted('select')).toBeUndefined()
    items()[2]!.click()
    expect(wrapper.emitted('select')).toEqual([['share']])
    expect(wrapper.props('open')).toBe(true)
    wrapper.unmount()
  })

  it('closes on a press outside, also when opened by hand', async () => {
    for (const trigger of ['click', 'manual']) {
      const wrapper = withModel({ trigger, open: true })
      await nextTick()
      expect(items()).toHaveLength(4)
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await nextTick()
      expect(wrapper.props('open')).toBe(false)
      wrapper.unmount()
    }
  })

  it('closes on Escape and gives focus back to the trigger', async () => {
    const wrapper = withModel({ open: true })
    await nextTick()
    items()[0]!.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    expect(document.activeElement?.id).toBe('trigger')
    wrapper.unmount()
  })
})
