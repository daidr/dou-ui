import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouDropdown, DouDropdownItem, DouDropdownRadioGroup } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const items = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
const firstItem = () => items()[0]!
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

  it('opens a hover menu on a tap and keeps it open after the finger lifts', async () => {
    vi.useFakeTimers()
    const wrapper = withModel({ trigger: 'hover' })
    const trigger = wrapper.get('#trigger')
    // a tap: touch pointer events, then the mouse events phones send after it
    await trigger.trigger('pointerenter', { pointerType: 'touch' })
    await trigger.trigger('pointerdown', { pointerType: 'touch' })
    await trigger.trigger('pointerleave', { pointerType: 'touch' })
    await trigger.trigger('mouseenter')
    await trigger.trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(true)
    await trigger.trigger('mouseleave')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.props('open')).toBe(true)
    // the same trigger tapped again closes it
    await trigger.trigger('pointerdown', { pointerType: 'touch' })
    await trigger.trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(false)
    // and a press outside closes what a tap opened
    await trigger.trigger('pointerdown', { pointerType: 'touch' })
    await trigger.trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(true)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('opens a hover menu on a pen tap, the same as a finger', async () => {
    vi.useFakeTimers()
    const wrapper = withModel({ trigger: 'hover' })
    const trigger = wrapper.get('#trigger')
    // a pen that cannot hover enters and leaves with the press
    await trigger.trigger('pointerenter', { pointerType: 'pen' })
    await trigger.trigger('pointerdown', { pointerType: 'pen' })
    await trigger.trigger('pointerleave', { pointerType: 'pen' })
    await trigger.trigger('click', { detail: 1 })
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.props('open')).toBe(true)
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('forgets a press that scrolled the page instead of tapping', async () => {
    const wrapper = withModel({ trigger: 'hover' })
    const trigger = wrapper.get('#trigger')
    await trigger.trigger('pointerdown', { pointerType: 'touch' })
    await trigger.trigger('pointercancel', { pointerType: 'touch' })
    // Enter from the keyboard afterwards opens the menu at its first item
    await trigger.trigger('click', { detail: 0 })
    await nextTick()
    expect(wrapper.props('open')).toBe(true)
    await nextTick()
    expect(document.activeElement).toBe(firstItem())
    wrapper.unmount()
  })

  it('opens on a click with no press before it, as screen readers send', async () => {
    const wrapper = withModel({ trigger: 'hover' })
    await wrapper.get('#trigger').trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(true)
    wrapper.unmount()
  })

  it('still opens and closes a hover menu with the mouse', async () => {
    vi.useFakeTimers()
    const wrapper = withModel({ trigger: 'hover' })
    const trigger = wrapper.get('#trigger')
    await trigger.trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(wrapper.props('open')).toBe(true)
    // a click with the mouse leaves the hover menu as it is
    await trigger.trigger('pointerdown', { pointerType: 'mouse' })
    await trigger.trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(true)
    await trigger.trigger('pointerleave', { pointerType: 'mouse' })
    vi.advanceTimersByTime(150)
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
    vi.useRealTimers()
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

  it('names an item by its label and describes it with its description', async () => {
    const wrapper = mount(DouDropdown, {
      props: {
        open: false,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      slots: {
        default: () => h('button', { id: 'trigger' }, '共享'),
        menu: () => [
          h(DouDropdownItem, { value: 'plain' }, () => '复制'),
          h(
            DouDropdownItem,
            { value: 'team', description: '上海办公室的成员都能查看', shortcut: 'mod+t' },
            () => '团队成员',
          ),
          h(
            DouDropdownItem,
            { value: 'link' },
            { default: () => '知道链接的人', description: () => h('b', '不用登录') },
          ),
        ],
      },
      attachTo: document.body,
    })
    await wrapper.get('#trigger').trigger('click')
    const [plain, team, link] = items()
    // no description, no change
    expect(plain!.hasAttribute('aria-labelledby')).toBe(false)
    expect(plain!.hasAttribute('aria-describedby')).toBe(false)
    expect(plain!.querySelector('.dou-dropdown__description')).toBeNull()
    for (const [item, label, description] of [
      [team!, '团队成员', '上海办公室的成员都能查看'],
      [link!, '知道链接的人', '不用登录'],
    ] as const) {
      expect(item.classList).toContain('is-described')
      const name = document.getElementById(item.getAttribute('aria-labelledby')!)
      const desc = document.getElementById(item.getAttribute('aria-describedby')!)
      expect(name?.textContent?.trim()).toBe(label)
      expect(desc?.textContent?.trim()).toBe(description)
    }
    expect(team!.getAttribute('aria-keyshortcuts')).toBe('Control+T')
    wrapper.unmount()
  })

  it('jumps by the label alone, not the description', async () => {
    const wrapper = mount(DouDropdown, {
      props: {
        open: false,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      slots: {
        default: () => h('button', { id: 'trigger' }, '更多'),
        menu: () => [
          h(DouDropdownItem, { value: 'a', description: 'beta 版本' }, () => 'alpha'),
          h(DouDropdownItem, { value: 'b' }, () => 'beta'),
        ],
      },
      attachTo: document.body,
    })
    await wrapper.get('#trigger').trigger('click')
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!
    menu.focus()
    key(menu, 'b')
    expect(document.activeElement).toBe(items()[1])
    wrapper.unmount()
  })

  it('passes the description of items given as data', async () => {
    const wrapper = mount(DouDropdown, {
      props: {
        open: false,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
        items: [{ key: 'delete', label: '删除', description: '30 天后彻底删除' }],
      },
      slots: { default: () => h('button', { id: 'trigger' }, '更多') },
      attachTo: document.body,
    })
    await wrapper.get('#trigger').trigger('click')
    expect(items()[0]!.querySelector('.dou-dropdown__description')?.textContent).toBe(
      '30 天后彻底删除',
    )
    wrapper.unmount()
  })

  it('follows a description slot that comes and goes', async () => {
    const shown = ref(false)
    const wrapper = mount(DouDropdown, {
      props: { open: true },
      slots: {
        default: () => h('button', '更多'),
        menu: () =>
          h(
            DouDropdownItem,
            { value: 'team' },
            shown.value
              ? { default: () => '团队成员', description: () => '上海办公室的成员' }
              : { default: () => '团队成员' },
          ),
      },
      attachTo: document.body,
    })
    await nextTick()
    expect(firstItem().classList).not.toContain('is-described')
    shown.value = true
    await nextTick()
    expect(firstItem().classList).toContain('is-described')
    expect(
      document.getElementById(firstItem().getAttribute('aria-describedby')!)?.textContent,
    ).toBe('上海办公室的成员')
    shown.value = false
    await nextTick()
    expect(firstItem().classList).not.toContain('is-described')
    expect(firstItem().hasAttribute('aria-describedby')).toBe(false)
    expect(firstItem().querySelector('.dou-dropdown__description')).toBeNull()
    wrapper.unmount()
  })
})
