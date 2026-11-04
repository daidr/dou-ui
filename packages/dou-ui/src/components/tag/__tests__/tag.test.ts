import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouTag } from '../../../index'

describe('DouTag', () => {
  it('is a quiet neutral tag by default', () => {
    const wrapper = mount(DouTag, { slots: { default: 'beta' } })
    expect(wrapper.text()).toBe('beta')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-tag', 'dou-tag--soft', 'dou-tag--neutral', 'dou-tag--md']),
    )
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('applies variant, tone, size and round', () => {
    const wrapper = mount(DouTag, {
      props: { variant: 'outline', tone: 'success', size: 'sm', round: true },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-tag--outline', 'dou-tag--success', 'dou-tag--sm', 'is-round']),
    )
  })

  it('emits close from an accessible remove button', async () => {
    const wrapper = mount(DouTag, { props: { closable: true } })
    const close = wrapper.get('button')
    expect(close.attributes('type')).toBe('button')
    expect(close.attributes('aria-label')).toBe('移除')
    await close.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('renders the leading slot', () => {
    const wrapper = mount(DouTag, { slots: { leading: '●', default: '运行中' } })
    expect(wrapper.find('.dou-tag__icon').text()).toBe('●')
  })

  it('shows the whole label on hover only when the ellipsis cuts it', async () => {
    const text = '上海市浦东新区世纪大道 100 号环球金融中心 52 层'
    const wrapper = mount(DouTag, { slots: { default: text } })
    const label = wrapper.get('.dou-tag__label')
    const sizes = { scrollWidth: 120, clientWidth: 120 }
    for (const key of ['scrollWidth', 'clientWidth'] as const) {
      Object.defineProperty(label.element, key, { configurable: true, get: () => sizes[key] })
    }

    await label.trigger('pointerenter')
    expect(label.attributes('title')).toBeUndefined()

    sizes.scrollWidth = 360
    await label.trigger('pointerenter')
    expect(label.attributes('title')).toBe(text)

    sizes.scrollWidth = 120
    await label.trigger('pointerenter')
    expect(label.attributes('title')).toBeUndefined()
  })

  it('keeps a title given to the tag instead of the automatic one', async () => {
    const wrapper = mount(DouTag, {
      attrs: { title: '收货地址' },
      slots: { default: '上海市浦东新区世纪大道 100 号环球金融中心 52 层' },
    })
    const label = wrapper.get('.dou-tag__label')
    Object.defineProperty(label.element, 'scrollWidth', { configurable: true, get: () => 360 })
    Object.defineProperty(label.element, 'clientWidth', { configurable: true, get: () => 120 })
    await label.trigger('pointerenter')
    expect(label.attributes('title')).toBeUndefined()
    expect(wrapper.attributes('title')).toBe('收货地址')
  })
})
