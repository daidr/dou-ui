import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { VNode } from 'vue'
import { DouContextMenu, DouDropdownItem, DouMenu } from '../../../index'
import type { MenuItemOption, MenuKey, MenuOption } from '../../../index'

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

/** The accessible name and description an element gets from the ids it points at. */
const nameAndDescription = (el: Element) => {
  const text = (attr: string) =>
    el
      .getAttribute(attr)
      ?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .join(' ')
  return [el.getAttribute('aria-label') ?? text('aria-labelledby'), text('aria-describedby')]
}

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

  it('draws an item’s actions beside it, never inside it', async () => {
    const wrapper = mount(DouMenu, {
      props: {
        items: [
          { key: 'a', label: '上海门店排班' },
          { key: 'b', label: '十月周报' },
        ],
        modelValue: 'b',
      },
      slots: {
        actions: (scope: { item: MenuItemOption }) =>
          scope.item.key === 'a' ? h('button', { class: 'approve' }, '看完了') : null,
      },
      attachTo: document.body,
    })
    const entries = wrapper.findAll('.dou-menu__entry')
    const actions = entries[0]!.get('.dou-menu__actions')
    expect(actions.element.parentElement).toBe(entries[0]!.element)
    expect(entries[0]!.find('.dou-menu__item .approve').exists()).toBe(false)
    expect(entries[1]!.find('.dou-menu__actions').exists()).toBe(false)
    expect(entries[1]!.classes()).toContain('is-current')
    await actions.get('.approve').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.classes()).toContain('dou-menu--actions-hover')
    await wrapper.setProps({ actionsVisible: 'always' })
    expect(wrapper.classes()).toContain('dou-menu--actions-always')
    wrapper.unmount()
  })

  it('calls the actions slot once an item and hands the focus back when a button goes', async () => {
    const done = ref(false)
    const actions = vi.fn<(scope: { item: MenuItemOption }) => VNode | null>((scope) =>
      scope.item.key === 'a' && !done.value
        ? h('button', { class: 'approve', onClick: () => (done.value = true) }, '看完了')
        : null,
    )
    const wrapper = mount(DouMenu, {
      props: {
        items: [
          { key: 'a', label: '上海门店排班' },
          { key: 'b', label: '十月周报' },
        ],
      },
      slots: { actions },
      attachTo: document.body,
    })
    expect(actions).toHaveBeenCalledTimes(2)
    const approve = wrapper.get<HTMLButtonElement>('.approve')
    approve.element.focus()
    await approve.trigger('click')
    await nextTick()
    await nextTick()
    expect(wrapper.find('.dou-menu__actions').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.findAll('.dou-menu__item')[0]!.element)
    wrapper.unmount()
  })

  it('draws no actions part without the slot', () => {
    const { wrapper } = make()
    expect(wrapper.findComponent({ name: 'DouMenuActions' }).exists()).toBe(false)
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
    const section = menu.querySelector<HTMLElement>('[role="group"][aria-labelledby]')!
    expect(
      document.getElementById(section.getAttribute('aria-labelledby')!)!.textContent!.trim(),
    ).toBe('设置')
    expect(section.textContent).toContain('成员')
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

  it('tells which item was right-clicked', async () => {
    const pressed: [MenuKey, string][] = []
    const wrapper = mount(DouMenu, {
      props: {
        items,
        onItemContextmenu: (option: MenuItemOption, event: MouseEvent) =>
          pressed.push([option.key, event.type]),
      },
      attachTo: document.body,
    })
    await item(wrapper, '首页').trigger('contextmenu')
    await item(wrapper, '项目').trigger('contextmenu')
    await item(wrapper, '归档').trigger('contextmenu')
    expect(pressed).toEqual([
      ['home', 'contextmenu'],
      ['projects', 'contextmenu'],
      ['archive', 'contextmenu'],
    ])
    wrapper.unmount()
  })

  describe('description', () => {
    const described: MenuOption[] = [
      { key: 'home', label: '首页', icon: Icon, description: '本周的待办和动态' },
      {
        key: 'projects',
        label: '项目',
        icon: Icon,
        description: '上海办公室的全部项目',
        children: [
          { key: 'list', label: '项目列表', description: '按更新时间排列' },
          { key: 'plain', label: '没有说明' },
          {
            key: 'settings',
            label: '设置',
            description: '项目的权限和集成',
            children: [{ key: 'members', label: '成员', description: '戴兜和另外 3 人' }],
          },
        ],
      },
      { key: 'billing', label: '账单' },
    ]
    it('shows it under the label of an expanded vertical menu', () => {
      const wrapper = mount(DouMenu, {
        props: { items: described, expanded: ['projects'] },
        attachTo: document.body,
      })
      const rows = wrapper.findAll('[data-dou-menu-item]')
      const home = rows.find((row) => row.text().startsWith('首页'))!
      expect(home.classes()).toContain('is-described')
      expect(home.get('.dou-menu__description').text()).toBe('本周的待办和动态')
      expect(nameAndDescription(home.element)).toEqual(['首页', '本周的待办和动态'])
      // a submenu row has one too
      const projects = rows.find((row) => row.text().startsWith('项目'))!
      expect(nameAndDescription(projects.element)).toEqual(['项目', '上海办公室的全部项目'])
      // no description, no change
      const plain = rows.find((row) => row.text() === '没有说明')!
      expect(plain.classes()).not.toContain('is-described')
      expect(plain.attributes('aria-labelledby')).toBeUndefined()
      expect(plain.attributes('aria-describedby')).toBeUndefined()
      expect(plain.find('.dou-menu__description').exists()).toBe(false)
      wrapper.unmount()
    })

    it('only reads it in the top row of a horizontal menu', () => {
      const wrapper = mount(DouMenu, {
        props: { items: described, mode: 'horizontal' },
        attachTo: document.body,
      })
      const row = (label: string) =>
        wrapper
          .findAll('[data-dou-menu-item]')
          .find((one) => one.find('.dou-menu__label').text() === label)!
      const home = row('首页')
      expect(home.classes()).not.toContain('is-described')
      expect(home.find('.dou-menu__description').exists()).toBe(false)
      expect(nameAndDescription(home.element)).toEqual(['首页', '本周的待办和动态'])
      const projects = row('项目')
      expect(nameAndDescription(projects.element)).toEqual(['项目', '上海办公室的全部项目'])
      wrapper.unmount()
    })

    it('only reads it on the icons of a collapsed menu', () => {
      const wrapper = mount(DouMenu, {
        props: { items: described, collapsed: true },
        attachTo: document.body,
      })
      expect(nameAndDescription(wrapper.get('[aria-label="首页"]').element)).toEqual([
        '首页',
        '本周的待办和动态',
      ])
      expect(nameAndDescription(wrapper.get('[aria-label="项目"]').element)).toEqual([
        '项目',
        '上海办公室的全部项目',
      ])
      wrapper.unmount()
    })

    it('passes it to the items of a popup', async () => {
      const wrapper = mount(DouMenu, {
        props: { items: described, collapsed: true },
        attachTo: document.body,
      })
      await wrapper.get('[aria-label="项目"]').trigger('keydown', { key: 'ArrowDown' })
      await nextTick()
      const menu = document.querySelector('[role="menu"]')!
      const rows = [...menu.querySelectorAll('[role="menuitem"]')]
      const find = (label: string) =>
        rows.find(
          (row) => row.querySelector('.dou-dropdown__label')?.textContent?.trim() === label,
        )!
      expect(nameAndDescription(find('项目列表'))).toEqual(['项目列表', '按更新时间排列'])
      expect(nameAndDescription(find('成员'))).toEqual(['成员', '戴兜和另外 3 人'])
      expect(find('没有说明').getAttribute('aria-describedby')).toBeNull()
      // a deeper submenu turns into a heading, too small for it: its group reads it
      const group = menu.querySelector('[role="group"]')!
      expect(nameAndDescription(group)).toEqual(['设置', '项目的权限和集成'])
      expect(group.querySelector('.dou-dropdown__group-label')!.textContent!.trim()).toBe('设置')
      wrapper.unmount()
    })

    it('takes the label and description slots inline and in popups', async () => {
      const slots = {
        label: (scope: { item: MenuItemOption; selected: boolean }) =>
          h('i', `${scope.item.label}${scope.selected ? '·当前' : ''}`),
        description: (scope: { item: MenuItemOption }) => h('b', `【${scope.item.description}】`),
      }
      const inline = mount(DouMenu, {
        props: { items: described, expanded: ['projects'], modelValue: 'list' },
        slots,
        attachTo: document.body,
      })
      const list = inline
        .findAll('[data-dou-menu-item]')
        .find((row) => row.find('.dou-menu__label').text() === '项目列表·当前')!
      expect(list.get('.dou-menu__description b').text()).toBe('【按更新时间排列】')
      // items without a description stay without one
      expect(inline.findAll('.dou-menu__description')).toHaveLength(5)
      inline.unmount()

      const collapsed = mount(DouMenu, {
        props: { items: described, collapsed: true, modelValue: 'list' },
        slots,
        attachTo: document.body,
      })
      expect(nameAndDescription(collapsed.get('[aria-label="首页"]').element)).toEqual([
        '首页',
        '【本周的待办和动态】',
      ])
      await collapsed.get('[aria-label="项目"]').trigger('keydown', { key: 'ArrowDown' })
      await nextTick()
      const menu = document.querySelector('[role="menu"]')!
      const rows = [...menu.querySelectorAll('[role="menuitem"]')]
      expect(rows.map((row) => row.querySelector('.dou-dropdown__label')?.textContent)).toEqual([
        '项目列表·当前',
        '没有说明',
        '成员',
      ])
      expect(rows[0]!.querySelector('.dou-dropdown__description b')?.textContent).toBe(
        '【按更新时间排列】',
      )
      expect(rows[1]!.querySelector('.dou-dropdown__description')).toBeNull()
      expect(nameAndDescription(menu.querySelector('[role="group"]')!)).toEqual([
        '设置',
        '【项目的权限和集成】',
      ])
      collapsed.unmount()
    })
  })

  it('tells which popup item was right-clicked', async () => {
    const pressed: MenuKey[] = []
    const wrapper = mount(DouMenu, {
      props: {
        items,
        collapsed: true,
        onItemContextmenu: (option: MenuItemOption) => pressed.push(option.key),
      },
      attachTo: document.body,
    })
    await wrapper.get('[aria-label="项目"]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const menu = document.querySelector('[role="menu"]')!
    ;[...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((el) => el.textContent?.trim() === '成员')!
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(pressed).toEqual(['members'])
    wrapper.unmount()
  })

  it('works inside DouContextMenu', async () => {
    let target: MenuItemOption | undefined
    const chosen: string[] = []
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouContextMenu,
            {
              teleport: false,
              onSelect: (value: unknown) => chosen.push(`${String(value)}:${target?.key}`),
            },
            {
              default: () =>
                h(DouMenu, {
                  items,
                  onItemContextmenu: (option: MenuItemOption) => (target = option),
                }),
              menu: () => h(DouDropdownItem, { value: 'pin' }, () => '置顶'),
            },
          ),
      }),
      { attachTo: document.body },
    )
    await item(wrapper, '个人资料').trigger('contextmenu', { clientX: 20, clientY: 20 })
    await nextTick()
    await wrapper.get('[role="menuitem"]').trigger('click')
    expect(chosen).toEqual(['pin:profile'])
    wrapper.unmount()
  })
})
