import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouDropdown, DouDropdownItem, DouDropdownRadioGroup } from '../../../index'

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

  it('moves through checkbox and radio items with the keyboard too', async () => {
    const wrapper = mount(DouDropdown, {
      props: {
        open: false,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      slots: {
        default: () => h('button', { id: 'trigger' }, '视图'),
        menu: () => [
          h(DouDropdownItem, { value: 'grid', checked: true }, () => '网格'),
          h(DouDropdownRadioGroup, { modelValue: 'sm' }, () => [
            h(DouDropdownItem, { value: 'sm' }, () => '小'),
            h(DouDropdownItem, { value: 'lg' }, () => '大'),
          ]),
        ],
      },
      attachTo: document.body,
    })
    key(wrapper.get('#trigger').element, 'ArrowDown')
    await nextTick()
    await nextTick()
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemcheckbox')
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemradio')
    key(document.activeElement!, 'End')
    expect(document.activeElement?.textContent).toBe('大')
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

  it('renders items given as data, runs the chosen one, and prefers a menu slot', async () => {
    const rename = vi.fn<() => void>()
    const onSelect = vi.fn<(value: unknown) => void>()
    const wrapper = mount(DouDropdown, {
      props: {
        open: false,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
        items: [
          { key: 'rename', label: '重命名', run: rename },
          { key: 'delete', label: '删除', tone: 'danger' as const, divided: true },
        ],
        onSelect,
      },
      slots: { default: () => h('button', { id: 'trigger' }, '更多') },
      attachTo: document.body,
    })
    await wrapper.get('#trigger').trigger('click')
    expect(items().map((el) => el.textContent?.trim())).toEqual(['重命名', '删除'])
    items()[0]!.click()
    expect(rename).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('rename')
    await wrapper.get('#trigger').trigger('click')
    // no run: select alone
    items()[1]!.click()
    expect(onSelect).toHaveBeenLastCalledWith('delete')
    wrapper.unmount()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const both = mount(DouDropdown, {
      props: { items: [{ key: 'x', label: 'x' }] },
      slots: { default: () => h('button', '更多'), menu: () => h(DouDropdownItem, () => '插槽') },
      attachTo: document.body,
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('`items` is ignored')
    warn.mockRestore()
    both.unmount()
  })
})
