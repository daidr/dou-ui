import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createCommentVNode, createTextVNode, defineComponent, h, ref } from 'vue'
import { DouStatusDot } from '../../../index'

describe('DouStatusDot', () => {
  it('renders a neutral medium dot without a ripple by default', () => {
    const wrapper = mount(DouStatusDot)
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-status-dot', 'dou-status-dot--neutral', 'dou-status-dot--md']),
    )
    expect(wrapper.classes()).not.toContain('is-ripple')
    expect(wrapper.find('.dou-status-dot__dot').exists()).toBe(true)
    expect(wrapper.find('.dou-status-dot__label').exists()).toBe(false)
  })

  it('takes a tone, a size and the ripple', () => {
    const wrapper = mount(DouStatusDot, { props: { tone: 'success', size: 'lg', ripple: true } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-status-dot--success', 'dou-status-dot--lg', 'is-ripple']),
    )
  })

  it('lets the text beside it speak for the dot', () => {
    const wrapper = mount(DouStatusDot, {
      props: { label: '忽略' },
      slots: { default: '运行中' },
    })
    expect(wrapper.get('.dou-status-dot__label').text()).toBe('运行中')
    expect(wrapper.get('.dou-status-dot__dot').attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('aria-label')).toBeUndefined()
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
  })

  it('announces a bare dot only through its label', async () => {
    const wrapper = mount(DouStatusDot)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    await wrapper.setProps({ label: '在线' })
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('在线')
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
  })

  it('follows text that appears or goes away later', async () => {
    const show = ref(false)
    const Host = defineComponent(
      () => () => h(DouStatusDot, { label: '在线' }, show.value ? { default: () => '运行中' } : {}),
    )
    const wrapper = mount(Host)
    const root = () => wrapper.get('.dou-status-dot')
    expect(root().attributes('role')).toBe('img')
    show.value = true
    await wrapper.vm.$nextTick()
    expect(root().text()).toBe('运行中')
    expect(root().attributes('role')).toBeUndefined()
    expect(root().attributes('aria-label')).toBeUndefined()
    show.value = false
    await wrapper.vm.$nextTick()
    expect(root().attributes('role')).toBe('img')
    expect(root().attributes('aria-label')).toBe('在线')
  })

  it('takes an aria-label written on a bare dot as its label', () => {
    const wrapper = mount(DouStatusDot, { attrs: { 'aria-label': '在线' } })
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('在线')
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
  })

  it('falls back to the label when the slot renders nothing', () => {
    for (const content of [() => '', () => [createCommentVNode('v-if'), createTextVNode('  ')]]) {
      const wrapper = mount(DouStatusDot, { props: { label: '在线' }, slots: { default: content } })
      expect(wrapper.find('.dou-status-dot__label').exists()).toBe(false)
      expect(wrapper.attributes('role')).toBe('img')
      expect(wrapper.attributes('aria-label')).toBe('在线')
    }
  })
})
