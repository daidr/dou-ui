import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouChatReasoning } from '../../../index'

afterEach(() => vi.useRealTimers())

describe('DouChatReasoning', () => {
  it('opens while thinking, then folds and says how long it took', async () => {
    vi.useFakeTimers()
    const wrapper = mount(DouChatReasoning, {
      props: { thinking: true },
      slots: { default: () => '先看看用户的问题' },
    })
    const trigger = wrapper.get('.dou-chat-reasoning__trigger')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(trigger.text()).toBe('正在思考')
    expect(wrapper.find('.dou-shimmer.is-active').exists()).toBe(true)

    vi.advanceTimersByTime(12_400)
    await wrapper.setProps({ thinking: false })
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.text()).toBe('已思考 12 秒')
    expect(wrapper.emitted('update:open')).toEqual([[false]])

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('shows a given duration, in minutes past one', () => {
    const wrapper = mount(DouChatReasoning, { props: { duration: 75 } })
    expect(wrapper.get('.dou-chat-reasoning__trigger').text()).toBe('已思考 1 分 15 秒')
  })

  it('names itself when the duration is unknown, and follows `open`', () => {
    const wrapper = mount(DouChatReasoning, { props: { open: true } })
    const trigger = wrapper.get('.dou-chat-reasoning__trigger')
    expect(trigger.text()).toBe('思考过程')
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('stays open after thinking without `autoCollapse`', async () => {
    const wrapper = mount(DouChatReasoning, { props: { thinking: true, autoCollapse: false } })
    await wrapper.setProps({ thinking: false })
    expect(wrapper.get('.dou-chat-reasoning__trigger').attributes('aria-expanded')).toBe('true')
  })
})
