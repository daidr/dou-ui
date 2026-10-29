import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DouDropdown,
  DouDropdownItem,
  DouDropdownRadioGroup,
  DouMenubar,
  DouMenubarMenu,
} from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
const openMenus = () =>
  [...document.querySelectorAll<HTMLElement>('.dou-dropdown')].filter(
    (menu) => menu.style.display !== 'none',
  )

function mountBar() {
  const selected: unknown[] = []
  const wrapper = mount(DouMenubar, {
    props: { onSelect: (value: unknown, menu: string) => selected.push([value, menu]) },
    slots: {
      default: () => [
        h(DouMenubarMenu, { label: '文件' }, () => [
          h(DouDropdownItem, { value: 'new' }, () => '新建'),
          h(DouDropdownItem, { value: 'open' }, () => '打开'),
        ]),
        h(DouMenubarMenu, { label: '插件', disabled: true }),
        h(DouMenubarMenu, { label: '编辑' }, () => [
          h(DouDropdownItem, { value: 'undo' }, () => '撤销'),
        ]),
      ],
    },
    attachTo: document.body,
  })
  const triggers = () => wrapper.findAll('.dou-menubar__trigger')
  return { wrapper, triggers, selected }
}

describe('DouMenubar', () => {
  it('is a menubar of menu buttons with one tab stop', async () => {
    const { wrapper, triggers } = mountBar()
    await nextTick()
    expect(wrapper.attributes('role')).toBe('menubar')
    expect(triggers().map((t) => t.attributes('role'))).toEqual([
      'menuitem',
      'menuitem',
      'menuitem',
    ])
    expect(triggers().map((t) => t.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(triggers()[0]!.attributes('aria-haspopup')).toBe('menu')
  })

  it('opens on click and switches menus on hover while one is open', async () => {
    const { triggers } = mountBar()
    await triggers()[2]!.trigger('pointerenter')
    expect(openMenus()).toHaveLength(0)
    await triggers()[0]!.trigger('click')
    expect(openMenus()).toHaveLength(1)
    expect(triggers()[0]!.attributes('aria-expanded')).toBe('true')
    await triggers()[2]!.trigger('pointerenter')
    await nextTick()
    expect(triggers()[0]!.attributes('aria-expanded')).toBe('false')
    expect(triggers()[2]!.attributes('aria-expanded')).toBe('true')
  })

  it('moves to the next enabled menu with the arrow keys inside a menu', async () => {
    const { triggers, selected } = mountBar()
    await triggers()[0]!.trigger('click')
    await nextTick()
    const first = document.querySelector<HTMLElement>('[role="menuitem"].dou-dropdown__item')!
    first.focus()
    key(first, 'ArrowRight')
    await nextTick()
    await nextTick()
    expect(triggers()[2]!.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement?.textContent).toBe('撤销')
    ;(document.activeElement as HTMLElement).click()
    expect(selected).toEqual([['undo', '编辑']])
  })
})

describe('checkable dropdown items', () => {
  it('toggles a checkbox item and picks a radio item', async () => {
    const grid = ref(false)
    const zoom = ref(100)
    mount(DouDropdown, {
      props: { open: true },
      slots: {
        default: () => h('button', '视图'),
        menu: () => [
          h(
            DouDropdownItem,
            {
              checked: grid.value,
              shortcut: 'shift+mod+g',
              'onUpdate:checked': (value: boolean) => (grid.value = value),
            },
            () => '网格',
          ),
          h(
            DouDropdownRadioGroup,
            {
              modelValue: zoom.value,
              'onUpdate:modelValue': (value: unknown) => (zoom.value = value as number),
            },
            () => [
              h(DouDropdownItem, { value: 100 }, () => '100%'),
              h(DouDropdownItem, { value: 200 }, () => '200%'),
            ],
          ),
        ],
      },
      attachTo: document.body,
    })
    await nextTick()
    const checkbox = document.querySelector<HTMLElement>('[role="menuitemcheckbox"]')!
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    expect(checkbox.getAttribute('aria-keyshortcuts')).toBe('Shift+Control+G')
    expect(checkbox.textContent).toContain('Shift+Ctrl+G')
    checkbox.click()
    expect(grid.value).toBe(true)

    const radios = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    radios[1]!.click()
    expect(zoom.value).toBe(200)
  })
})
