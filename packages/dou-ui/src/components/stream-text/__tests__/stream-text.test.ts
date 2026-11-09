import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouStreamText } from '../../../index'
import { safeCut } from '../stream-text'

let now = 0
let queue: FrameRequestCallback[] = []
function frames(count: number, step = 16) {
  for (let i = 0; i < count; i++) {
    now += step
    const run = queue
    queue = []
    for (const cb of run) cb(now)
  }
}

beforeEach(() => {
  now = 0
  queue = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = []
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('DouStreamText', () => {
  it('shows text that is already complete at once', () => {
    const wrapper = mount(DouStreamText, { props: { content: '你好，戴兜' } })
    expect(wrapper.text()).toBe('你好，戴兜')
    expect(wrapper.find('.dou-stream-text__caret').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })

  it('reveals a stream gradually and reports when done', async () => {
    const wrapper = mount(DouStreamText, { props: { content: '', streaming: true } })
    expect(wrapper.find('.dou-stream-text__caret').exists()).toBe(true)
    expect(wrapper.attributes('aria-busy')).toBe('true')

    await wrapper.setProps({ content: '今天上海天气晴朗' })
    frames(2, 100)
    await nextTick()
    const partial = wrapper.text()
    expect(partial.length).toBeGreaterThan(0)
    expect(partial.length).toBeLessThan(8)

    frames(60, 100)
    await nextTick()
    expect(wrapper.text()).toBe('今天上海天气晴朗')
    expect(wrapper.emitted('done')).toBeUndefined()

    await wrapper.setProps({ streaming: false })
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.find('.dou-stream-text__caret').exists()).toBe(false)
  })

  it('shows text as it arrives when `smooth` is off', async () => {
    const wrapper = mount(DouStreamText, {
      props: { content: '', streaming: true, smooth: false },
    })
    await wrapper.setProps({ content: '一段' })
    expect(wrapper.text()).toBe('一段')
  })

  it('flushes on demand and keeps the matching part of replaced text', async () => {
    const wrapper = mount(DouStreamText, { props: { content: '', streaming: true } })
    await wrapper.setProps({ content: 'abcdef' })
    ;(wrapper.vm as unknown as { flush: () => void }).flush()
    await nextTick()
    expect(wrapper.text()).toBe('abcdef')
    await wrapper.setProps({ content: 'abcXYZ' })
    expect(wrapper.text()).toBe('abc')
  })

  it('hands the revealed text to the slot', () => {
    const wrapper = mount(DouStreamText, {
      props: { content: '**加粗**' },
      slots: { default: ({ text }: { text: string }) => h('b', text) },
    })
    expect(wrapper.get('b').text()).toBe('**加粗**')
    expect(wrapper.classes()).not.toContain('is-plain')
  })

  it('never cuts a surrogate pair in half', () => {
    const text = 'a😀b'
    expect(safeCut(text, 2)).toBe(3)
    expect(safeCut(text, 1)).toBe(1)
    expect(safeCut(text, 9)).toBe(4)
  })

  it('puts the trailing slot after the last character and the caret', () => {
    const wrapper = mount(DouStreamText, {
      props: { content: '正在写', streaming: true, smooth: false },
      slots: { trailing: () => h('span', { class: 'mark' }, '已编辑') },
    })
    const tail = [...wrapper.element.children].map((el) => el.className)
    expect(tail).toEqual(['dou-stream-text__caret', 'dou-stream-text__trailing'])
    expect(wrapper.find('.dou-stream-text__trailing .mark').exists()).toBe(true)
  })
})
