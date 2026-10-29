import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouChatList } from '../../../index'

function sized(el: HTMLElement, scrollHeight: number, clientHeight = 100) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
}

describe('DouChatList', () => {
  it('is a labelled log', () => {
    const wrapper = mount(DouChatList, { slots: { default: () => '消息' } })
    const viewport = wrapper.get('.dou-chat-list__viewport')
    expect(viewport.attributes('role')).toBe('log')
    expect(viewport.attributes('aria-label')).toBe('消息列表')
    expect(wrapper.get('.dou-chat-list__content').text()).toBe('消息')
  })

  it('shows the scroll button away from the bottom and goes back down', async () => {
    const wrapper = mount(DouChatList, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000)
    el.scrollTop = 900
    await wrapper.get('.dou-chat-list__viewport').trigger('scroll')
    expect(wrapper.find('.dou-chat-list__scroll-button').exists()).toBe(false)

    el.scrollTop = 400
    await wrapper.get('.dou-chat-list__viewport').trigger('scroll')
    expect(wrapper.emitted('update:atBottom')).toEqual([[false]])
    const button = wrapper.get('.dou-chat-list__scroll-button')
    expect(button.attributes('aria-label')).toBe('回到底部')

    el.scrollTo = ((options: ScrollToOptions) => {
      el.scrollTop = options.top!
    }) as typeof el.scrollTo
    await button.trigger('click')
    expect(el.scrollTop).toBe(1000)
    wrapper.unmount()
  })

  it('reports reaching the top once per visit', async () => {
    const wrapper = mount(DouChatList)
    const viewport = wrapper.get('.dou-chat-list__viewport')
    const el = viewport.element as HTMLElement
    sized(el, 1000)
    el.scrollTop = 0
    await viewport.trigger('scroll')
    await viewport.trigger('scroll')
    expect(wrapper.emitted('topReached')).toHaveLength(1)
    el.scrollTop = 300
    await viewport.trigger('scroll')
    el.scrollTop = 0
    await viewport.trigger('scroll')
    expect(wrapper.emitted('topReached')).toHaveLength(2)
    await nextTick()
  })
})
