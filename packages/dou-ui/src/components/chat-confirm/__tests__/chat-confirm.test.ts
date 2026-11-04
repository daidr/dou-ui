import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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

  it('keeps focus on the card when its buttons go away', async () => {
    const wrapper = mount(DouChatConfirm, {
      props: { title: '运行命令？' },
      attachTo: document.body,
    })
    const allow = wrapper.findAll('.dou-chat-confirm__actions button').at(-1)!
    ;(allow.element as HTMLElement).focus()
    await wrapper.setProps({ status: 'withdrawn' })
    await nextTick()
    expect(document.activeElement).toBe(wrapper.element)
    wrapper.unmount()
  })

  it('leaves focus alone when it was elsewhere', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    const wrapper = mount(DouChatConfirm, {
      props: { title: '运行命令？' },
      attachTo: document.body,
    })
    await wrapper.setProps({ status: 'withdrawn' })
    await nextTick()
    expect(document.activeElement).toBe(outside)
    wrapper.unmount()
    outside.remove()
  })

  it('keeps its live region mounted while waiting, so the outcome is announced', async () => {
    const wrapper = mount(DouChatConfirm, { props: { title: '运行命令？' } })
    const region = wrapper.get('[role="status"]')
    expect(region.text()).toBe('')
    await wrapper.setProps({ status: 'withdrawn' })
    expect(wrapper.get('[role="status"]').element).toBe(region.element)
    expect(region.text()).toBe('已撤回')
  })

  it('shows no outcome for a status it does not know, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChatConfirm, {
      props: { title: '删除文件？', status: 'pending' as never },
    })
    expect(wrapper.get('.dou-chat-confirm__result').text()).toBe('')
    expect(warn).toHaveBeenCalledWith(
      '[dou-ui] DouChatConfirm: unknown status `pending`, expected one of `waiting`, `approved`, `denied`, `withdrawn`. Use `waiting`.',
    )
    warn.mockRestore()
  })
})
