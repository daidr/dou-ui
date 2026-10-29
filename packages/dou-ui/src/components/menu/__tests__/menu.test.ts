import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouMenu } from '../../../index'
import type { MenuKey, MenuOption } from '../../../index'

const Icon = defineComponent({ render: () => h('svg', { class: 'icon' }) })

const items: MenuOption[] = [
  { key: 'home', label: '首页', icon: Icon },
  {
    key: 'projects',
    label: '项目',
    icon: Icon,
    children: [
      { key: 'list', label: '项目列表' },
      { key: 'archive', label: '归档', disabled: true },
      { key: 'settings', label: '设置', children: [{ key: 'members', label: '成员' }] },
    ],
  },
  {
    type: 'group',
    label: '账户',
    children: [
      { key: 'profile', label: '个人资料', icon: Icon },
      { key: 'docs', label: '文档', href: 'https://example.com/docs' },
    ],
  },
  { type: 'divider' },
  { key: 'billing', label: '账单', children: [{ key: 'invoices', label: '发票' }] },
]

afterEach(() => {
  document.body.innerHTML = ''
})

const make = (props: Record<string, unknown> = {}) => {
  const value = ref<MenuKey | undefined>(props.modelValue as MenuKey | undefined)
  const selected: MenuKey[] = []
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(DouMenu, {
            items,
            ...props,
            modelValue: value.value,
            'onUpdate:modelValue': (v: MenuKey | undefined) => (value.value = v),
            onSelect: (key: MenuKey) => selected.push(key),
          })
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, value, selected }
}

const item = (wrapper: ReturnType<typeof make>['wrapper'], label: string) =>
  wrapper.findAll('[data-dou-menu-item]').find((el) => el.text() === label)!

describe('DouMenu', () => {
  it('renders a navigation landmark with groups and dividers', () => {
    const { wrapper } = make()
    expect(wrapper.element.tagName).toBe('NAV')
    expect(wrapper.find('ul[aria-label]').attributes('aria-label')).toBe('账户')
    expect(wrapper.findAll('.dou-menu__divider[aria-hidden="true"]')).toHaveLength(1)
    expect(item(wrapper, '文档').element.tagName).toBe('A')
    expect(item(wrapper, '文档').attributes('href')).toBe('https://example.com/docs')
    expect(item(wrapper, '首页').element.tagName).toBe('BUTTON')
    expect(item(wrapper, '首页').find('.icon').exists()).toBe(true)
  })

  it('opens the submenus around the current item and marks it', () => {
    const { wrapper } = make({ modelValue: 'members' })
    expect(item(wrapper, '项目').attributes('aria-expanded')).toBe('true')
    expect(item(wrapper, '设置').attributes('aria-expanded')).toBe('true')
    expect(item(wrapper, '账单').attributes('aria-expanded')).toBe('false')
    expect(item(wrapper, '成员').attributes('aria-current')).toBe('page')
    expect(item(wrapper, '项目').classes()).toContain('is-active')
    const sub = wrapper.get(`#${item(wrapper, '项目').attributes('aria-controls')}`)
    expect(sub.element.tagName).toBe('UL')
  })

  it('selects leaves and toggles submenus', async () => {
    const { wrapper, value, selected } = make()
    await item(wrapper, '项目').trigger('click')
    expect(item(wrapper, '项目').attributes('aria-expanded')).toBe('true')
    await item(wrapper, '项目列表').trigger('click')
    expect(value.value).toBe('list')
    expect(selected).toEqual(['list'])
    await item(wrapper, '归档').trigger('click')
    expect(value.value).toBe('list')
    await item(wrapper, '项目').trigger('click')
    expect(item(wrapper, '项目').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('keeps one submenu open in accordion mode', async () => {
    const { wrapper } = make({ accordion: true })
    await item(wrapper, '项目').trigger('click')
    await item(wrapper, '账单').trigger('click')
    expect(item(wrapper, '项目').attributes('aria-expanded')).toBe('false')
    expect(item(wrapper, '账单').attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('emits update:expanded', async () => {
    const wrapper = mount(DouMenu, { props: { items, expanded: [] } })
    await wrapper.findAll('[data-dou-menu-item]')[1]!.trigger('click')
    expect(wrapper.emitted('update:expanded')).toEqual([[['projects']]])
  })

  it('moves focus with the arrow keys', async () => {
    const { wrapper } = make()
    const home = item(wrapper, '首页')
    ;(home.element as HTMLElement).focus()
    await home.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item(wrapper, '项目').element)
    await item(wrapper, '项目').trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(item(wrapper, '项目').attributes('aria-expanded')).toBe('true')
    await item(wrapper, '项目').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(item(wrapper, '账单').element)
    wrapper.unmount()
  })

  it('shows icons alone when collapsed and opens submenus in popups', async () => {
    const { wrapper, value } = make({ collapsed: true })
    expect(wrapper.classes()).toContain('is-collapsed')
    const home = wrapper.get('[aria-label="首页"]')
    expect(home.find('.dou-menu__label').exists()).toBe(false)
    const projects = wrapper.get('[aria-label="项目"]')
    expect(projects.attributes('aria-haspopup')).toBe('menu')
    await projects.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const menu = document.querySelector('[role="menu"]')!
    expect(menu.textContent).toContain('项目列表')
    // a deeper submenu becomes a labelled section
    expect(menu.querySelector('.dou-menu__popup-label')!.textContent!.trim()).toBe('设置')
    ;[...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((el) => el.textContent?.trim() === '成员')!
      .click()
    await nextTick()
    expect(value.value).toBe('members')
    wrapper.unmount()
  })

  it('lays the items out in a row horizontally', () => {
    const { wrapper } = make({ mode: 'horizontal', modelValue: 'list' })
    expect(wrapper.classes()).toContain('dou-menu--horizontal')
    expect(item(wrapper, '项目').attributes('aria-haspopup')).toBe('menu')
    expect(item(wrapper, '项目').classes()).toContain('is-active')
    // groups flatten into the row
    expect(item(wrapper, '个人资料').exists()).toBe(true)
  })
})
