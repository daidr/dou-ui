import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatSteps } from '../../../index'

describe('DouChatSteps', () => {
  it('names the running step, then counts the steps', async () => {
    const wrapper = mount(DouChatSteps, {
      props: {
        items: [
          { label: '搜索网页', detail: '上海 骑行' },
          { label: '读取网页', status: 'running' },
        ],
      },
    })
    const header = wrapper.get('.dou-chat-steps__header')
    expect(header.text()).toBe('读取网页')
    expect(wrapper.classes()).toContain('is-running')
    expect(header.attributes('aria-expanded')).toBe('false')

    await wrapper.setProps({ items: [{ label: '搜索网页' }, { label: '读取网页' }] })
    expect(header.text()).toBe('已完成 2 个步骤')
    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.dou-chat-steps__step')).toHaveLength(2)
  })

  it('follows `live` over the steps', async () => {
    const wrapper = mount(DouChatSteps, {
      props: { open: true, live: false, items: [{ label: '读取网页', status: 'running' }] },
    })
    expect(wrapper.get('.dou-chat-steps__header').text()).toBe('共 1 个步骤')
    expect(wrapper.classes()).not.toContain('is-running')
    expect(wrapper.find('.dou-spinner').exists()).toBe(false)
    expect(wrapper.get('.dou-status-dot').classes()).toContain('dou-status-dot--neutral')

    await wrapper.setProps({ live: true, items: [{ label: '读取网页' }] })
    expect(wrapper.get('.dou-chat-steps__header').text()).toBe('正在处理')
    expect(wrapper.find('.dou-shimmer.is-active').exists()).toBe(true)
  })

  it('shows the detail and the detail slot', () => {
    const wrapper = mount(DouChatSteps, {
      props: { open: true, items: [{ label: '搜索网页', detail: '上海 骑行' }] },
      slots: { detail: () => '3 个结果' },
    })
    expect(wrapper.get('.dou-chat-steps__detail').text()).toBe('上海 骑行')
    expect(wrapper.get('.dou-chat-steps__extra').text()).toBe('3 个结果')
  })
})
