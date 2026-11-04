import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { DouChatPlan } from '../../../index'

const items = [
  { label: '查天气', status: 'done' as const },
  { label: '挑路线', status: 'running' as const },
  { label: '订餐厅', status: 'skipped' as const },
  { label: '发通知' },
]

describe('DouChatPlan', () => {
  it('counts finished steps and marks each status', async () => {
    const wrapper = mount(DouChatPlan, { props: { items } })
    expect(wrapper.get('.dou-chat-plan__title').text()).toBe('任务计划')
    expect(wrapper.get('.dou-chat-plan__count').text()).toBe('2 / 4')
    const rows = wrapper.findAll('.dou-chat-plan__item')
    expect(rows.map((row) => row.classes().find((c) => c.startsWith('is-')))).toEqual([
      'is-done',
      'is-running',
      'is-skipped',
      'is-pending',
    ])
    expect(rows[1]!.find('.dou-shimmer.is-active').exists()).toBe(true)
    const header = wrapper.get('.dou-chat-plan__header')
    expect(header.attributes('aria-expanded')).toBe('true')
    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
  it('renders a plain panel when not collapsible', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChatPlan, {
      props: { items, collapsible: false, open: false },
    })
    expect(wrapper.classes()).toContain('is-open')
    expect(wrapper.classes()).not.toContain('is-collapsible')
    const header = wrapper.get('.dou-chat-plan__header')
    expect(header.element.tagName).toBe('DIV')
    expect(header.attributes('aria-expanded')).toBeUndefined()
    expect(wrapper.find('.dou-chat-plan__arrow').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-plan__count').text()).toBe('2 / 4')
    expect(wrapper.get('.dou-chat-plan__panel').attributes('style') ?? '').not.toContain(
      'display: none',
    )
    expect(wrapper.get('.dou-chat-plan__panel').attributes('aria-labelledby')).toBe(
      header.attributes('id'),
    )
    await header.trigger('click')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    warn.mockRestore()
  })
  it('warns once that open is ignored on a plain panel', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const quiet = mount(DouChatPlan, { props: { items, collapsible: false } })
    expect(warn).not.toHaveBeenCalled()
    quiet.unmount()
    const wrapper = mount(DouChatPlan, { props: { items, collapsible: false, open: true } })
    await wrapper.setProps({ open: false })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[dou-ui] DouChatPlan: `open` is ignored when `collapsible` is false.',
    )
    warn.mockRestore()
  })
})
