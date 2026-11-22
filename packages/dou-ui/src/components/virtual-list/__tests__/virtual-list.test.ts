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
    expect(rendered[0]!.attributes('style')).not.toContain('transform')
    const pads = wrapper.findAll('.dou-virtual-list__pad')
    // at scrollTop 0 there is only a trailing pad for the remaining 988 items
    expect(pads).toHaveLength(1)
    expect(pads[0]!.attributes('aria-hidden')).toBe('true')
    expect(pads[0]!.attributes('style')).toContain(`height: ${(1000 - 12) * 32}px`)
    expect(wrapper.attributes('style')).toContain('height: 320px')
    wrapper.unmount()
  })

  it('takes focus so the keyboard can scroll it', () => {
    const wrapper = make()
    expect(wrapper.attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('follows the scroll position with leading and trailing pads in normal flow', async () => {
    const wrapper = make()
    const el = wrapper.element as HTMLElement
    // happy-dom lays nothing out; a browser reports the total flow height
    Object.defineProperty(el, 'scrollHeight', { get: () => 32_000 })
    el.scrollTop = 3200
    await wrapper.trigger('scroll')
    const rendered = wrapper.findAll('.dou-virtual-list__item')
    // first = 100, last = 109, overscan = 2 -> indices 98..111
    expect(rendered).toHaveLength(14)
    expect(rendered[0]!.text()).toBe('第 98 项')
    expect(rendered[2]!.text()).toBe('第 100 项')
    for (const item of rendered) expect(item.attributes('style')).not.toContain('transform')
    const pads = wrapper.findAll('.dou-virtual-list__pad')
    expect(pads).toHaveLength(2)
    expect(pads[0]!.attributes('style')).toContain(`height: ${98 * 32}px`)
    expect(pads[1]!.attributes('style')).toContain(`height: ${(1000 - 112) * 32}px`)
    expect(wrapper.emitted('scroll')).toHaveLength(1)
    wrapper.unmount()
  })

  it('omits the trailing pad once the last item is rendered', async () => {
    const wrapper = make()
    const vm = wrapper.vm as unknown as { scrollToIndex: (index: number, align?: string) => void }
    vm.scrollToIndex(999, 'end')
    await nextTick()
    const rendered = wrapper.findAll('.dou-virtual-list__item')
    expect(rendered.at(-1)!.text()).toBe('第 999 项')
    const pads = wrapper.findAll('.dou-virtual-list__pad')
    expect(pads).toHaveLength(1)
    const firstIndex = Number(rendered[0]!.attributes('data-index'))
    expect(pads[0]!.attributes('style')).toContain(`height: ${firstIndex * 32}px`)
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
    const rendered = wrapper.findAll('.dou-virtual-list__item')
    const second = rendered[1]!
    expect(second.attributes('style')).toContain('height: 40px')
    expect(second.attributes('style')).not.toContain('transform')
    const renderedHeight = rendered.reduce((sum, _, index) => sum + (index % 2 ? 40 : 20), 0)
    const pads = wrapper.findAll('.dou-virtual-list__pad')
    expect(pads).toHaveLength(1)
    expect(pads[0]!.attributes('style')).toContain(`height: ${30000 - renderedHeight}px`)
    wrapper.unmount()
  })

  it('shows the empty slot without items', () => {
    const wrapper = mount(DouVirtualList, {
      props: { items: [], itemSize: 32 },
      slots: { empty: () => '空' },
    })
    expect(wrapper.text()).toBe('空')
  })

  it('respects scroll-padding-block-end when aligning an item to the end', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ id: index }))
    const wrapper = mount(DouVirtualList, {
      props: { items: rows, itemSize: 40, height: 240 },
      slots: { default: ({ item }: { item: { id: number } }) => String(item.id) },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-virtual-list').element as HTMLElement
    el.style.scrollPaddingBlockEnd = '80px'
    const exposed = wrapper.vm as unknown as {
      scrollToIndex: (index: number, align?: 'start' | 'center' | 'end' | 'nearest') => void
    }
    // item 10 occupies [400, 440]; visible height is 240 - 80 = 160 -> scrollTop = 440 - 160 = 280
    exposed.scrollToIndex(10, 'end')
    expect(el.scrollTop).toBe(280)
    wrapper.unmount()
  })
})
