import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatConfirm } from '../../../index'

describe('DouChatConfirm', () => {
  it('asks and reports the decision', async () => {
    const wrapper = mount(DouChatConfirm, {
      props: { title: '允许修改 2 个文件？', allowAlways: true },
      slots: { default: () => 'diff' },
    })
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.classes()).toContain('is-waiting')
    expect(wrapper.get('.dou-chat-confirm__detail').text()).toBe('diff')
    const buttons = wrapper.findAll('.dou-chat-confirm__actions button')
    expect(buttons.map((b) => b.text())).toEqual(['拒绝', '总是允许', '允许'])
    await buttons[2]!.trigger('click')
    await buttons[1]!.trigger('click')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('decide')).toEqual([['approve'], ['always'], ['deny']])
  })

  it('shows the outcome once answered', () => {
    const wrapper = mount(DouChatConfirm, { props: { title: '删除文件？', status: 'denied' } })
    expect(wrapper.find('.dou-chat-confirm__actions').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-confirm__result').text()).toBe('已拒绝')
  })
})
