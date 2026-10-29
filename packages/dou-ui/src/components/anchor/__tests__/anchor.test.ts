import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DouAnchor } from '../../../index'

const items = [
  { href: '#intro', title: '介绍' },
  {
    href: '#usage',
    title: '用法',
    children: [{ href: '#props', title: '属性' }],
  },
  { href: '#faq', title: '常见问题' },
]

// Where each heading sits in the viewport, as the page scrolls.
let tops: Record<string, number> = {}

beforeEach(() => {
  for (const id of ['intro', 'usage', 'props', 'faq']) {
    const heading = document.createElement('h2')
    heading.id = id
    heading.getBoundingClientRect = () => ({ top: tops[id] ?? 0 }) as DOMRect
    document.body.append(heading)
  }
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0)
    return 0
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const scroll = async (next: Record<string, number>) => {
  tops = next
  window.dispatchEvent(new Event('scroll'))
  await nextTick()
  await nextTick()
}

describe('DouAnchor', () => {
  it('is a named navigation of nested links', () => {
    const wrapper = mount(DouAnchor, { props: { items }, attachTo: document.body })
    expect(wrapper.element.tagName).toBe('NAV')
    expect(wrapper.attributes('aria-label')).toBe('本页目录')
    expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '#intro',
      '#usage',
      '#props',
      '#faq',
    ])
    expect(wrapper.find('.dou-anchor__list.is-nested a').text()).toBe('属性')
    wrapper.unmount()
  })

  it('follows the section that has reached the offset', async () => {
    tops = { intro: 100, usage: 600, props: 900, faq: 1400 }
    const wrapper = mount(DouAnchor, {
      props: { items, offset: 64 },
      attachTo: document.body,
    })
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await scroll({ intro: -200, usage: 60, props: 300, faq: 900 })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['#usage'])
    await wrapper.setProps({ modelValue: '#usage' })
    const current = wrapper.get('[aria-current="location"]')
    expect(current.text()).toBe('用法')
    expect(current.classes()).toContain('is-active')

    await scroll({ intro: -900, usage: -500, props: -200, faq: 64 })
    expect(wrapper.emitted('change')!.at(-1)).toEqual(['#faq'])
    wrapper.unmount()
  })

  it('scrolls to a section on click and keeps it current', async () => {
    tops = { intro: 0, usage: 500, props: 800, faq: 1200 }
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const replace = vi.spyOn(history, 'replaceState')
    const wrapper = mount(DouAnchor, {
      props: { items, offset: 64 },
      attachTo: document.body,
    })
    await wrapper.findAll('a')[3]!.trigger('click')
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 1200 - 64 }))
    expect(replace).toHaveBeenCalledWith(history.state, '', '#faq')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['#faq'])
    expect(document.activeElement).toBe(document.getElementById('faq'))

    // the page scrolling past other sections on the way does not move the highlight
    await scroll({ intro: -300, usage: 40, props: 400, faq: 800 })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['#faq'])
    wrapper.unmount()
  })
})
