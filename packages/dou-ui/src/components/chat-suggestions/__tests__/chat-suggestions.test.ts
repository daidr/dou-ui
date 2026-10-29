import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatSuggestions } from '../../../index'

describe('DouChatSuggestions', () => {
  it('emits the picked suggestion', async () => {
    const wrapper = mount(DouChatSuggestions, {
      props: {
        title: '试试这样问',
        items: ['写一封邮件', { value: 'plan', label: '规划行程', disabled: true }],
      },
    })
    const list = wrapper.get('ul')
    expect(list.attributes('aria-labelledby')).toBe(
      wrapper.get('.dou-chat-suggestions__title').attributes('id'),
    )
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['写一封邮件', { label: '写一封邮件' }]])
    expect(buttons[1]!.attributes('disabled')).toBeDefined()
  })

  it('shows descriptions and columns as cards', () => {
    const wrapper = mount(DouChatSuggestions, {
      props: {
        variant: 'card',
        columns: 2,
        items: [{ label: '总结文档', description: '提炼要点和待办' }],
      },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-chat-suggestions--card', 'is-columns']),
    )
    expect(wrapper.attributes('style')).toContain('--dou-chat-suggestions-columns: 2')
    expect(wrapper.get('.dou-chat-suggestions__description').text()).toBe('提炼要点和待办')
  })
})
