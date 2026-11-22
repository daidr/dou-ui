import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import type { Component } from 'vue'
import { DouChatList, DouTable, DouVirtualList } from '../index'

// jsdom has no layout: heights come from `data-height`, and resize
// notices are sent by hand.
let observers: FakeObserver[] = []
class FakeObserver {
  elements = new Set<Element>()
  constructor(public callback: ResizeObserverCallback) {
    observers.push(this)
  }
  observe(element: Element) {
    this.elements.add(element)
  }
  unobserve(element: Element) {
    this.elements.delete(element)
  }
  disconnect() {
    this.elements.clear()
  }
}
function resizeAll() {
  for (const observer of observers) {
    const entries = [...observer.elements].map((target) => ({ target }) as ResizeObserverEntry)
    observer.callback(entries, observer as unknown as ResizeObserver)
  }
}

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeObserver)
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return Number((this as HTMLElement).dataset.height ?? 0)
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
})

describe('DouVirtualList with measured items', () => {
  const items = Array.from({ length: 100 }, (_, index) => ({ id: index }))

  it('counts unmeasured items at the estimate and rendered ones at their height', async () => {
    const wrapper = mount(DouVirtualList, {
      props: { items, itemKey: 'id', estimateSize: 50, height: 200, overscan: 0 },
      slots: { default: () => 'x' },
      attachTo: document.body,
    })
    const rendered = wrapper.findAll('.dou-virtual-list__item')
    expect(rendered).toHaveLength(4)
    expect(rendered[0]!.attributes('style')).toBeUndefined()
    expect(wrapper.get('.dou-virtual-list__pad').attributes('style')).toContain(
      `height: ${(100 - rendered.length) * 50}px`,
    )
    for (const item of rendered) item.element.setAttribute('data-height', '80')
    resizeAll()
    await nextTick()
    // at 80px each, only 3 items cover the 200px viewport; item 3 moves into the trailing pad at its measured 80px
    const shown = wrapper.findAll('.dou-virtual-list__item')
    expect(shown).toHaveLength(3)
    expect(wrapper.get('.dou-virtual-list__pad').attributes('style')).toContain(
      `height: ${80 + (100 - rendered.length) * 50}px`,
    )
    wrapper.unmount()
  })

  it('adjusts scrollTop when an item above the viewport changes height', async () => {
    const wrapper = mount(DouVirtualList, {
      props: { items, itemKey: 'id', estimateSize: 50, height: 200, overscan: 2 },
      slots: { default: () => 'x' },
      attachTo: document.body,
    })
    const el = wrapper.element as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 5000 })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 200 })
    el.scrollTop = 500
    await wrapper.trigger('scroll')
    const rendered = wrapper.findAll('.dou-virtual-list__item')
    // first = 10, overscan = 2 -> indices 8..15; items 8 and 9 sit above scrollTop 500
    expect(Number(rendered[0]!.attributes('data-index'))).toBe(8)
    for (const item of rendered) item.element.setAttribute('data-height', '50')
    rendered[0]!.element.setAttribute('data-height', '80')
    resizeAll()
    await nextTick()
    expect(el.scrollTop).toBe(530)
    wrapper.unmount()
  })
})

const expand = ({ row }: { row: { name: string } }) => h('p', `详情 ${row.name}`)

describe('DouTable with measured rows', () => {
  const Table = DouTable as Component
  const columns = [{ key: 'name', title: '名称' }]
  const data = Array.from({ length: 200 }, (_, index) => ({ id: index, name: `第 ${index} 行` }))

  it('shows detail rows and counts them into the row height', async () => {
    const wrapper = mount(Table, {
      props: {
        columns,
        data,
        rowKey: 'id',
        virtual: true,
        maxHeight: 440,
        expandable: true,
        expanded: [0],
      },
      slots: { expand },
      attachTo: document.body,
    })
    expect(wrapper.classes()).not.toContain('is-fixed-rows')
    const detail = wrapper.get('.dou-table__detail-row')
    expect(detail.text()).toBe('详情 第 0 行')
    const rows = wrapper.findAll('tbody tr.dou-table__row')
    for (const row of rows) row.element.setAttribute('data-height', '44')
    detail.element.setAttribute('data-height', '100')
    resizeAll()
    await nextTick()
    // the first row is 144 tall with its detail, so fewer rows fit in view
    const shown = wrapper.findAll('tbody tr.dou-table__row').length
    expect(shown).toBe(rows.length - 3)
    const after = wrapper.findAll('.dou-table__spacer td').at(-1)!
    expect(after.attributes('style')).toContain(`height: ${(200 - shown) * 44}px`)

    // closing the detail row gives its height back
    await wrapper.setProps({ expanded: [] })
    await nextTick()
    expect(wrapper.find('.dou-table__detail-row').exists()).toBe(false)
    await nextTick()
    expect(wrapper.findAll('tbody tr.dou-table__row')).toHaveLength(rows.length)
    wrapper.unmount()
  })

  it('keeps rows one line tall with `rowHeight`, without detail rows', () => {
    const wrapper = mount(Table, {
      props: { columns, data, rowKey: 'id', virtual: true, maxHeight: 440, rowHeight: 44 },
      slots: { expand },
    })
    expect(wrapper.classes()).toContain('is-fixed-rows')
    expect(wrapper.find('.dou-table__detail-row').exists()).toBe(false)
    expect(wrapper.get('tbody tr.dou-table__row').attributes('style')).toContain('height: 44px')
  })
})

describe('DouChatList with items', () => {
  it('renders messages from `items` through the item slot', () => {
    const items = Array.from({ length: 500 }, (_, index) => ({ id: index, text: `消息 ${index}` }))
    const wrapper = mount(DouChatList, {
      props: { items, itemKey: 'id' },
      slots: { item: ({ item }: { item: { text: string } }) => h('p', item.text) },
      attachTo: document.body,
    })
    expect(wrapper.classes()).toContain('is-virtual')
    const viewport = wrapper.get('.dou-chat-list__viewport')
    expect(viewport.attributes('role')).toBe('log')
    expect(wrapper.findAll('.dou-virtual-list__item').length).toBeLessThan(50)
    wrapper.unmount()
  })
})
