import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouShimmer } from '../../../index'

describe('DouShimmer', () => {
  it('sweeps while active', async () => {
    const wrapper = mount(DouShimmer, {
      props: { duration: 3 },
      slots: { default: () => '正在生成' },
    })
    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.classes()).toContain('is-active')
    expect(wrapper.attributes('style')).toContain('--dou-shimmer-duration: 3s')
    expect(wrapper.text()).toBe('正在生成')
    await wrapper.setProps({ active: false })
    expect(wrapper.classes()).not.toContain('is-active')
  })

  it('renders the element given by `as`', () => {
    const wrapper = mount(DouShimmer, { props: { as: 'p' } })
    expect(wrapper.element.tagName).toBe('P')
  })
})
