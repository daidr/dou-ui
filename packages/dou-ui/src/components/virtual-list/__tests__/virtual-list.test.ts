import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { DouVirtualList, createOffsets } from '../../../index'

const items = Array.from({ length: 1000 }, (_, index) => ({ id: index, name: `第 ${index} 项` }))

const make = (props: Record<string, unknown> = {}) =>
  mount(DouVirtualList, {
    props: { items, itemSize: 32, itemKey: 'id', height: 320, overscan: 2, ...props },
    slots: { default: ({ item }: { item: { name: string } }) => h('span', item.name) },
    attachTo: document.body,
  })

describe('createOffsets', () => {
  it('sums heights and finds the item at an offset', () => {
    const offsets = createOffsets(4, (index) => [10, 20, 30, 40][index]!)
    expect(offsets.total).toBe(100)
    expect(offsets.start(2)).toBe(30)
    expect(offsets.find(0)).toBe(0)
    expect(offsets.find(29)).toBe(1)
    expect(offsets.find(30)).toBe(2)
    expect(offsets.find(500)).toBe(3)
  })
})

describe('DouVirtualList', () => {
  it('renders only the items in view plus the overscan', () => {
    const wrapper = make()
    const rendered = wrapper.findAll('.dou-virtual-list__item')
    // 320 / 32 = 10 in view, 2 below
    expect(rendered).toHaveLength(12)
    expect(rendered[0]!.text()).toBe('第 0 项')
    expect(wrapper.get('.dou-virtual-list__spacer').attributes('style')).toContain(
      'height: 32000px',
    )
    expect(wrapper.attributes('style')).toContain('height: 320px')
    wrapper.unmount()
  })

  it('follows the scroll position', async () => {
    const wrapper = make()
    const el = wrapper.element as HTMLElement
    el.scrollTop = 3200
    await wrapper.trigger('scroll')
    const rendered = wrapper.findAll('.dou-virtual-list__item')
    expect(rendered[0]!.text()).toBe('第 98 项')
    expect(rendered[2]!.attributes('style')).toContain('translateY(3200px)')
    expect(wrapper.emitted('scroll')).toHaveLength(1)
    wrapper.unmount()
  })

  it('scrolls an item into view', async () => {
    const wrapper = make()
    const vm = wrapper.vm as unknown as { scrollToIndex: (index: number, align?: string) => void }
    vm.scrollToIndex(500, 'start')
    await nextTick()
    expect((wrapper.element as HTMLElement).scrollTop).toBe(16000)
    expect(wrapper.text()).toContain('第 500 项')
    // already visible: nearest does not move
    vm.scrollToIndex(505)
    expect((wrapper.element as HTMLElement).scrollTop).toBe(16000)
    wrapper.unmount()
  })

  it('supports a height per item', () => {
    const wrapper = make({ itemSize: (_: unknown, index: number) => (index % 2 ? 40 : 20) })
    expect(wrapper.get('.dou-virtual-list__spacer').attributes('style')).toContain(
      'height: 30000px',
    )
    const second = wrapper.findAll('.dou-virtual-list__item')[1]!
    expect(second.attributes('style')).toContain('height: 40px')
    expect(second.attributes('style')).toContain('translateY(20px)')
    wrapper.unmount()
  })

  it('shows the empty slot without items', () => {
    const wrapper = mount(DouVirtualList, {
      props: { items: [], itemSize: 32 },
      slots: { empty: () => '空' },
    })
    expect(wrapper.text()).toBe('空')
  })
})
