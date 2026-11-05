import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
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
    expect(wrapper.emitted('atBottomChange')).toEqual([[false]])
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

  it('scrolls a message into view by its element, and by its key with items', async () => {
    const wrapper = mount(DouChatList, {
      slots: { default: '<p>一</p><p id="two">二</p>' },
      attachTo: document.body,
    })
    const viewport = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    const scrollTo = vi.fn()
    viewport.scrollTo = scrollTo as typeof viewport.scrollTo
    const exposed = wrapper.vm as unknown as {
      scrollToMessage: (target: unknown, align?: string) => void
    }
    exposed.scrollToMessage(wrapper.get('#two').element, 'start')
    expect(scrollTo).toHaveBeenCalledTimes(1)
    // an element from elsewhere is left alone
    exposed.scrollToMessage(document.createElement('p'))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    wrapper.unmount()

    const items = Array.from({ length: 50 }, (_, index) => ({ id: `m${index}` }))
    const scrollToIndex = vi.fn()
    const VirtualList = defineComponent({
      name: 'DouVirtualList',
      setup(_, { expose }) {
        expose({ scrollToIndex, el: () => null })
        return () => h('div')
      },
    })
    const list = mount(DouChatList, {
      props: { items, itemKey: 'id' },
      global: { stubs: { DouVirtualList: VirtualList } },
    })
    await nextTick()
    const scrollToMessage = (list.vm as unknown as { scrollToMessage: (key: string) => void })
      .scrollToMessage
    scrollToMessage('m30')
    scrollToMessage('nope')
    expect(scrollToIndex).toHaveBeenCalledTimes(1)
    expect(scrollToIndex).toHaveBeenCalledWith(30, 'center')
    list.unmount()
  })
})
