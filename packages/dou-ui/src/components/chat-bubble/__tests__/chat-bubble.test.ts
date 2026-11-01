import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatBubble } from '../../../index'

describe('DouChatBubble', () => {
  it('shows the sender, time, content and footer', () => {
    const wrapper = mount(DouChatBubble, {
      props: {
        placement: 'end',
        name: '戴兜',
        time: '09:30',
        content: '帮我写个周报',
        avatar: 'a.png',
      },
      slots: { footer: () => '复制' },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-chat-bubble--end', 'dou-chat-bubble--soft', 'is-with-avatar']),
    )
    expect(wrapper.get('.dou-chat-bubble__name').text()).toBe('戴兜')
    expect(wrapper.get('.dou-chat-bubble__time').text()).toBe('09:30')
    expect(wrapper.get('.dou-chat-bubble__text').text()).toBe('帮我写个周报')
    expect(wrapper.find('.dou-avatar img').attributes('src')).toBe('a.png')
    expect(wrapper.get('.dou-chat-bubble__footer').text()).toBe('复制')
  })

  it('shows dots while loading and hides the footer', () => {
    const wrapper = mount(DouChatBubble, {
      props: { loading: true, content: '…' },
      slots: { footer: () => '复制' },
    })
    expect(wrapper.get('.dou-chat-bubble__dots').attributes('aria-label')).toBe('正在回复')
    expect(wrapper.find('.dou-chat-bubble__text').exists()).toBe(false)
    expect(wrapper.find('.dou-chat-bubble__footer').exists()).toBe(false)
    expect(wrapper.find('.dou-chat-bubble__avatar').exists()).toBe(false)
  })

  it('has no avatar in the center', () => {
    const wrapper = mount(DouChatBubble, {
      props: { placement: 'center', avatar: 'a.png' },
      slots: { default: () => '戴兜 加入了对话' },
    })
    expect(wrapper.find('.dou-chat-bubble__avatar').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-bubble__content').text()).toBe('戴兜 加入了对话')
  })
})
