import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatArtifact } from '../../../index'

describe('DouChatArtifact', () => {
  it('opens when pressed', async () => {
    const wrapper = mount(DouChatArtifact, {
      props: { title: '骑行计划.md', description: 'Markdown · 800 字', active: true },
    })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['is-done', 'is-active']))
    expect(wrapper.get('.dou-chat-artifact__description').text()).toBe('Markdown · 800 字')
    const main = wrapper.get('.dou-chat-artifact__main')
    expect(main.attributes('aria-current')).toBe('true')
    await main.trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('shimmers while running and swaps the arrow for actions', () => {
    const wrapper = mount(DouChatArtifact, {
      props: { title: 'chart.png', kind: 'image', status: 'running' },
      slots: { actions: () => '下载' },
    })
    expect(wrapper.find('.dou-shimmer.is-active').text()).toBe('正在生成…')
    expect(wrapper.find('.dou-chat-artifact__arrow').exists()).toBe(false)
    expect(wrapper.get('.dou-chat-artifact__actions').text()).toBe('下载')
  })

  it('shimmers its description while running, when it has one', () => {
    const wrapper = mount(DouChatArtifact, {
      props: { title: '报表来源', status: 'running', description: '找报表数据从哪来 · 1/3' },
    })
    expect(wrapper.find('.dou-shimmer.is-active').text()).toBe('找报表数据从哪来 · 1/3')
  })
})
