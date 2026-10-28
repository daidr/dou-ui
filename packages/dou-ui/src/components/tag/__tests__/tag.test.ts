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
})
