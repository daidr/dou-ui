import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouConfigProvider, DouLoading, en, vLoading } from '../../../index'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

describe('DouLoading', () => {
  it('covers its content with a labelled spinner while loading', async () => {
    const wrapper = mount(DouLoading, {
      props: { loading: false },
      slots: { default: () => h('p', '内容') },
    })
    expect(wrapper.find('.dou-loading__mask').exists()).toBe(false)
    expect(wrapper.get('.dou-loading').attributes('aria-busy')).toBeUndefined()

    await wrapper.setProps({ loading: true, text: '正在保存' })
    expect(wrapper.get('.dou-loading').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('正在保存')
    expect(wrapper.get('.dou-loading__text').text()).toBe('正在保存')
    expect(wrapper.text()).toContain('内容')
  })

  it('waits for `delay` before showing, and hides at once', async () => {
    vi.useFakeTimers()
    const wrapper = mount(DouLoading, {
      props: { loading: true, delay: 200 },
      slots: { default: () => 'x' },
    })
    expect(wrapper.find('.dou-loading__mask').exists()).toBe(false)
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(wrapper.find('.dou-loading__mask').exists()).toBe(true)

    await wrapper.setProps({ loading: false })
    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.find('.dou-loading__mask').exists()).toBe(false)
  })

  it('fullscreen covers the window above other layers and locks the page', async () => {
    const wrapper = mount(DouLoading, {
      props: { loading: true, fullscreen: true },
      attachTo: document.body,
    })
    await nextTick()
    const mask = document.querySelector<HTMLElement>('.dou-loading__mask')!
    expect(mask.closest('[data-v-app]')).toBeNull()
    expect(mask.classList).toContain('is-fullscreen')
    expect(Number(mask.style.zIndex)).toBeGreaterThan(2000)
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.setProps({ loading: false })
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('reads its default label from the locale', () => {
    const wrapper = mount({
      render: () =>
        h(DouConfigProvider, { locale: en }, () => h(DouLoading, { loading: true }, () => 'x')),
    })
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading')
  })
})

describe('v-loading', () => {
  const Host = defineComponent({
    props: { value: { type: [Boolean, Object], default: false } },
    setup(props) {
      return () =>
        withDirectives(h('section', { class: 'card' }, '内容'), [[vLoading, props.value]])
    },
  })

  it('adds and removes the mask on the element', async () => {
    const wrapper = mount(Host, { props: { value: false } })
    const el = wrapper.get('section').element
    expect(el.querySelector('.dou-loading__mask')).toBeNull()

    await wrapper.setProps({ value: { loading: true, text: '加载数据' } })
    expect(el.classList).toContain('dou-loading-parent')
    expect(el.getAttribute('aria-busy')).toBe('true')
    expect(el.querySelector('.dou-loading__text')?.textContent).toBe('加载数据')

    await wrapper.setProps({ value: false })
    expect(el.querySelector('.dou-loading__mask')).toBeNull()
    expect(el.classList).not.toContain('dou-loading-parent')
    expect(el.hasAttribute('aria-busy')).toBe(false)
  })

  it('keeps a pending delay through re-renders', async () => {
    vi.useFakeTimers()
    const value = ref<object>({ loading: true, delay: 100 })
    const wrapper = mount(
      defineComponent({
        setup: () => () => h(Host, { value: value.value }),
      }),
    )
    const el = wrapper.get('section').element
    vi.advanceTimersByTime(60)
    value.value = { loading: true, delay: 100, text: '还在加载' }
    await nextTick()
    vi.advanceTimersByTime(60)
    expect(el.querySelector('.dou-loading__text')?.textContent).toBe('还在加载')
  })

  it('cleans up on unmount', async () => {
    const wrapper = mount(Host, { props: { value: true } })
    const el = wrapper.get('section').element
    expect(el.querySelector('.dou-loading__mask')).not.toBeNull()
    wrapper.unmount()
    expect(el.querySelector('.dou-loading__mask')).toBeNull()
  })
})
