import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContextMenuEntry } from '../../../index'
import {
  DouContextMenu,
  DouDropdown,
  DouDropdownGroup,
  DouDropdownItem,
  DouDropdownRadioGroup,
} from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const rows = () => [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
const groups = () => [...document.querySelectorAll<HTMLElement>('[role="group"]')]
/** The text a group is named by. */
const nameOf = (group: HTMLElement) =>
  document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

function open(menu: () => unknown, props: Record<string, unknown> = {}) {
  const wrapper = mount(DouDropdown, {
    props: {
      open: false,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      ...props,
    },
    slots: { default: () => h('button', { id: 'trigger' }, '视图'), menu },
    attachTo: document.body,
  })
  return wrapper
}

describe('DouDropdownGroup', () => {
  it('names a group by its heading, which the keyboard and typing skip', async () => {
    const sort = ref('activity')
    const thumbs = ref(true)
    const wrapper = open(() => [
      h(
        DouDropdownRadioGroup,
        {
          label: '排序方式',
          modelValue: sort.value,
          'onUpdate:modelValue': (value: unknown) => (sort.value = value as string),
        },
        () => [
          h(DouDropdownItem, { value: 'activity' }, () => '上次活动'),
          h(DouDropdownItem, { value: 'name' }, () => '名称'),
        ],
      ),
      h(DouDropdownGroup, { label: '显示', divided: true }, () => [
        h(
          DouDropdownItem,
          {
            checked: thumbs.value,
            'onUpdate:checked': (value: boolean) => (thumbs.value = value),
          },
          () => '缩略图',
        ),
      ]),
    ])
    key(wrapper.get('#trigger').element, 'ArrowDown')
    await nextTick()
    await nextTick()
    const [sorting, display] = groups()
    expect(nameOf(sorting!)).toBe('排序方式')
    expect(nameOf(display!)).toBe('显示')
    // the heading is read once, as the group's name
    expect(sorting!.querySelector('.dou-dropdown__group-label')!.getAttribute('aria-hidden')).toBe(
      'true',
    )
    // a separator above the second group, outside it
    expect(display!.previousElementSibling?.getAttribute('role')).toBe('separator')

    expect(document.activeElement?.textContent).toBe('上次活动')
    key(document.activeElement!, 'ArrowDown')
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement?.textContent).toBe('缩略图')
    // "排" starts the heading only: nothing to jump to
    key(document.activeElement!, '排')
    expect(document.activeElement?.textContent).toBe('缩略图')

    rows()[1]!.click()
    expect(sort.value).toBe('name')
    wrapper.unmount()
  })

  it('takes the heading from a slot and leaves a group without one unnamed', async () => {
    const wrapper = open(() => [
      h(DouDropdownGroup, null, {
        label: () => h('b', '最近'),
        default: () => [h(DouDropdownItem, () => '报表')],
      }),
      h(DouDropdownRadioGroup, { modelValue: 'a' }, () => [
        h(DouDropdownItem, { value: 'a' }, () => 'A'),
      ]),
    ])
    await wrapper.get('#trigger').trigger('click')
    const [recent, plain] = groups()
    expect(nameOf(recent!)).toBe('最近')
    expect(recent!.querySelector('b')).not.toBeNull()
    expect(plain!.hasAttribute('aria-labelledby')).toBe(false)
    expect(plain!.querySelector('.dou-dropdown__group-label')).toBeNull()
    wrapper.unmount()
  })

  it('writes groups as data: each group whose items are all marked is one choice', async () => {
    const byName = vi.fn<() => void>()
    const items: ContextMenuEntry[] = [
      {
        type: 'group',
        label: '排序方式',
        children: [
          { key: 'activity', label: '上次活动', checked: true },
          { key: 'name', label: '名称', checked: false, run: byName },
        ],
      },
      { key: 'thumbs', label: '缩略图', checked: true, divided: true },
      { type: 'group', label: '更多', divided: true, children: [{ key: 'reset', label: '重置' }] },
      // nothing to show: no heading alone
      { type: 'group', label: '空', children: [] },
    ]
    const onSelect = vi.fn<(value: unknown) => void>()
    const data = mount(DouDropdown, {
      props: {
        open: false,
        'onUpdate:open': (value: boolean) => data.setProps({ open: value }),
        items,
        onSelect,
      },
      slots: { default: () => h('button', { id: 'trigger' }, '视图') },
      attachTo: document.body,
    })
    await data.get('#trigger').trigger('click')
    expect(rows().map((row) => row.getAttribute('role'))).toEqual([
      'menuitemradio',
      'menuitemradio',
      'menuitemcheckbox',
      'menuitem',
    ])
    expect(rows()[0]!.getAttribute('aria-checked')).toBe('true')
    expect(groups().map(nameOf)).toEqual(['排序方式', '更多'])
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(2)
    // a run inside a group is found too
    rows()[1]!.click()
    expect(byName).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('name')
    data.unmount()
  })

  it('groups the items of a context menu the same way', async () => {
    const wrapper = mount(DouContextMenu, {
      props: {
        items: [
          {
            type: 'group',
            label: '对齐',
            children: [
              { key: 'left', label: '左对齐' },
              { key: 'right', label: '右对齐' },
            ],
          },
        ] satisfies ContextMenuEntry[],
      },
      slots: { default: () => h('div', { id: 'area' }, '区域') },
      attachTo: document.body,
    })
    ;(wrapper.vm as unknown as { open: (x: number, y: number) => void }).open(10, 10)
    await nextTick()
    await nextTick()
    expect(groups().map(nameOf)).toEqual(['对齐'])
    expect(rows()).toHaveLength(2)
    wrapper.unmount()
  })
})
