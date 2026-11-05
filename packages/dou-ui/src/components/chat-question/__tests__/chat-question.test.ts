import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouChatMessage, DouChatQuestion } from '../../../index'
import type { ChatQuestionOption } from '../../../index'

const options: ChatQuestionOption[] = [
  { value: 'sh', label: '上海门店', description: '静安、徐汇两家' },
  { value: 'all', label: '全部门店' },
  { value: 'none', label: '先不排', disabled: true },
]

describe('DouChatQuestion', () => {
  it('asks and reports the option chosen', async () => {
    const wrapper = mount(DouChatQuestion, { props: { title: '排哪些门店？', options } })
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.classes()).toContain('is-waiting')
    const buttons = wrapper.findAll('.dou-chat-question__option')
    expect(buttons.map((b) => b.find('.dou-chat-question__label').text())).toEqual([
      '上海门店',
      '全部门店',
      '先不排',
    ])
    // named by the label, with the second line as its description
    const first = buttons[0]!
    expect(wrapper.get(`#${first.attributes('aria-labelledby')}`).text()).toBe('上海门店')
    expect(wrapper.get(`#${first.attributes('aria-describedby')}`).text()).toBe('静安、徐汇两家')
    expect(buttons[1]!.attributes('aria-describedby')).toBeUndefined()
    expect(buttons[2]!.attributes('disabled')).toBeDefined()
    await first.trigger('click')
    await buttons[2]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([['sh', options[0]]])
  })

  it('shows the answer once answered', () => {
    const wrapper = mount(DouChatQuestion, {
      props: { title: '排哪些门店？', options, status: 'answered', answer: 'all' },
    })
    expect(wrapper.find('.dou-chat-question__options').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-question__result').text()).toBe('全部门店')
  })

  it('says it was answered when the option is no longer listed', () => {
    const wrapper = mount(DouChatQuestion, {
      props: { title: '排哪些门店？', status: 'answered', answer: 'gone' },
    })
    expect(wrapper.get('.dou-chat-question__result').text()).toBe('已回答')
  })

  it('collapses to a withdrawn line, with the reason as its description', () => {
    const wrapper = mount(DouChatQuestion, {
      props: {
        title: '排哪些门店？',
        description: '戴兜已经在表格里排好了',
        options,
        status: 'withdrawn',
      },
    })
    expect(wrapper.classes()).toContain('is-withdrawn')
    expect(wrapper.find('.dou-chat-question__options').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-question__description').text()).toBe('戴兜已经在表格里排好了')
    expect(wrapper.get('.dou-chat-question__result').text()).toBe('已撤回')
    expect(wrapper.get('.dou-chat-question__result').attributes('role')).toBe('status')
  })

  it('keeps focus on the card when its options go away', async () => {
    const wrapper = mount(DouChatQuestion, {
      props: { title: '排哪些门店？', options },
      attachTo: document.body,
    })
    ;(wrapper.get('.dou-chat-question__option').element as HTMLElement).focus()
    await wrapper.setProps({ status: 'answered', answer: 'sh' })
    await nextTick()
    expect(document.activeElement).toBe(wrapper.element)
    wrapper.unmount()
  })

  it('is a part of a chat message', async () => {
    const part = { type: 'question' as const, id: 7, title: '排哪些门店？', options }
    const wrapper = mount(DouChatMessage, { props: { parts: [part] } })
    const question = wrapper.getComponent(DouChatQuestion)
    expect(question.attributes('id')).toBeUndefined()
    await question.get('.dou-chat-question__option').trigger('click')
    expect(wrapper.emitted('question')).toEqual([[part, 'sh']])
  })
})
