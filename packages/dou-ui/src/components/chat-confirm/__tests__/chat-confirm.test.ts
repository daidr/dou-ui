import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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
    const wrapper = mount(DouChatConfirm, {
      props: { title: '删除文件？', status: 'denied' },
    })
    expect(wrapper.find('.dou-chat-confirm__actions').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-confirm__result').text()).toBe('已拒绝')
  })

  it('collapses to a withdrawn line when no answer is needed any more', () => {
    const wrapper = mount(DouChatConfirm, {
      props: { title: '运行命令？', status: 'withdrawn' },
      slots: { default: () => 'bun install' },
    })
    expect(wrapper.classes()).toContain('is-withdrawn')
    expect(wrapper.find('.dou-chat-confirm__actions').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-confirm__result').text()).toBe('已撤回')
    expect(wrapper.get('.dou-chat-confirm__result').attributes('role')).toBe('status')
  })

  it('shows no outcome for a status it does not know, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChatConfirm, {
      props: { title: '删除文件？', status: 'pending' as never },
    })
    expect(wrapper.find('.dou-chat-confirm__result').exists()).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      '[dou-ui] DouChatConfirm: unknown status `pending`, expected one of `waiting`, `approved`, `denied`, `withdrawn`. Use `waiting`.',
    )
    warn.mockRestore()
  })
})
