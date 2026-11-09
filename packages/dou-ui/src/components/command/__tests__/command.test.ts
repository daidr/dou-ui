import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouCommand, DouCommandDialog, fuzzyMatch } from '../../../index'
import type { CommandItem } from '../../../index'

const items: CommandItem[] = [
  { value: 'new', label: '新建项目', group: '操作', shortcut: 'mod+n' },
  { value: 'deploy', label: 'Deploy to production', group: '操作', keywords: ['上线', 'release'] },
  { value: 'disabled', label: 'Delete project', group: '操作', disabled: true },
  { value: 'settings', label: 'Open settings', group: '导航', description: '域名、环境变量与权限' },
  { value: 'docs', label: 'Documentation', group: '导航' },
]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('fuzzyMatch', () => {
  it('prefers substrings and word starts', () => {
    expect(fuzzyMatch('Open settings', 'set')!.indices).toEqual([5, 6, 7])
    expect(fuzzyMatch('Deploy to production', 'dtp')!.indices).toEqual([0, 7, 10])
    expect(fuzzyMatch('Deploy', 'xyz')).toBeNull()
    const prefix = fuzzyMatch('Documentation', 'doc')!.score
    const inner = fuzzyMatch('Open docs', 'doc')!.score
    expect(prefix).toBeGreaterThan(inner)
  })
})

describe('DouCommand', () => {
  it('lists the items in groups with combobox semantics', () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const input = wrapper.get('input')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('placeholder')).toBe('输入命令或搜索…')
    expect(wrapper.findAll('[role="group"]')).toHaveLength(2)
    expect(wrapper.findAll('.dou-command__group-label').map((label) => label.text())).toEqual([
      '操作',
      '导航',
    ])
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(5)
    expect(input.attributes('aria-activedescendant')).toBe(options[0]!.attributes('id'))
    wrapper.unmount()
  })

  it("shows a shortcut as this platform's keys", () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const option = wrapper.findAll('[role="option"]')[0]!
    expect(option.get('.dou-command__shortcut').text()).toBe('CtrlN')
    expect(option.attributes('aria-keyshortcuts')).toBe('Control+N')
    expect(wrapper.findAll('[role="option"]')[1]!.attributes('aria-keyshortcuts')).toBeUndefined()
  })

  it('filters, ranks and highlights', async () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    await wrapper.get('input').setValue('do')
    const labels = wrapper.findAll('[role="option"]').map((option) => option.text())
    // "Documentation" starts with it; "Deploy to production" only spells it out
    expect(labels[0]).toBe('Documentation')
    expect(labels).toContain('Deploy to production')
    expect(wrapper.find('.dou-command__match').text()).toBe('Do')

    await wrapper.get('input').setValue('上线')
    expect(wrapper.findAll('[role="option"]').map((option) => option.text())).toEqual([
      'Deploy to production',
    ])

    await wrapper.get('input').setValue('zzz')
    expect(wrapper.get('.dou-command__empty').text()).toBe('没有匹配的结果')
    wrapper.unmount()
  })

  it('moves with the arrows, skipping disabled items, and selects with Enter', async () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const input = wrapper.get('input')
    const active = () => wrapper.get(`#${input.attributes('aria-activedescendant')}`).text()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(active()).toContain('Open settings')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ value: 'deploy' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    // wraps around
    expect(active()).toBe('Documentation')
    wrapper.unmount()
  })
})

describe('DouCommandDialog', () => {
  it('opens with the hotkey, focuses the search and closes on select', async () => {
    const wrapper = mount(DouCommandDialog, {
      props: { items, hotkey: 'ctrl+k' },
      attachTo: document.body,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await nextTick()
    expect(wrapper.emitted('update:open')![0]).toEqual([true])
    await wrapper.setProps({ open: true })
    await nextTick()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>('.dou-command__input')!
    expect(document.activeElement).toBe(input)
    expect(document.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe(
      '输入命令或搜索…',
    )
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ value: 'new' })
    expect(wrapper.emitted('update:open')!.at(-1)).toEqual([false])
    wrapper.unmount()
  })
})

describe('DouCommand highlight', () => {
  it('keeps the highlight when the parent passes an equal list again', async () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    const before = input.attributes('aria-activedescendant')
    await wrapper.setProps({ items: items.map((item) => ({ ...item })) })
    expect(input.attributes('aria-activedescendant')).toBe(before)
    wrapper.unmount()
  })
})

const heights = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[role="option"]')].map((row) => row.style.height)

describe('DouCommand row height', () => {
  const many: CommandItem[] = Array.from({ length: 30 }, (_, index) => ({
    value: index,
    label: `第 ${index} 条`,
    description: index % 2 ? '上海 · 戴兜' : undefined,
  }))

  it('leaves rows to their content unless the list is virtual', () => {
    const wrapper = mount(DouCommand, { props: { items, virtual: false } })
    expect(heights(wrapper.element).every((height) => height === '')).toBe(true)
    wrapper.unmount()
  })

  it('gives each virtual row its itemSize, by number or by item', async () => {
    const wrapper = mount(DouCommand, { props: { items: many, virtual: true } })
    await nextTick()
    expect(new Set(heights(wrapper.element))).toEqual(new Set(['36px']))
    await wrapper.setProps({ itemSize: 52 })
    expect(new Set(heights(wrapper.element))).toEqual(new Set(['52px']))
    await wrapper.setProps({
      itemSize: (item: CommandItem) => (item.description ? 52 : 36),
    })
    expect(heights(wrapper.element).slice(0, 2)).toEqual(['36px', '52px'])
    wrapper.unmount()
  })

  it('passes virtual and itemSize through the dialog', async () => {
    const wrapper = mount(DouCommandDialog, {
      props: { items: many, open: true, virtual: true, itemSize: 48 },
      attachTo: document.body,
    })
    await nextTick()
    expect(new Set(heights(document))).toEqual(new Set(['48px']))
    wrapper.unmount()
  })
})
