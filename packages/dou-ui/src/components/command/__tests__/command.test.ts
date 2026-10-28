import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouCommand, DouCommandDialog, fuzzyMatch } from '../../../index'
import type { CommandItem } from '../../../index'

const items: CommandItem[] = [
  { value: 'new', label: '新建项目', group: '操作', shortcut: ['⌘', 'N'] },
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
    expect(wrapper.findAll('kbd').map((key) => key.text())).toEqual(['⌘', 'N'])
    wrapper.unmount()
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
