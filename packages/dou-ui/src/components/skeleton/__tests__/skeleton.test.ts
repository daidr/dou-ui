import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouSkeleton } from '../../../index'

describe('DouSkeleton', () => {
  it('draws hidden placeholder lines', () => {
    const wrapper = mount(DouSkeleton, { props: { lines: 3 } })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('.dou-skeleton__item')).toHaveLength(3)
    expect(wrapper.classes()).toContain('is-animated')
  })

  it('sizes a circle from its width', () => {
    const wrapper = mount(DouSkeleton, { props: { variant: 'circle', width: 32 } })
    const style = wrapper.attributes('style')
    expect(style).toContain('--dou-skeleton-width: 32px')
    expect(style).toContain('--dou-skeleton-height: 32px')
  })

  it('shows the content once loaded', async () => {
    const wrapper = mount(DouSkeleton, { props: { loading: true }, slots: { default: '内容' } })
    expect(wrapper.text()).toBe('')
    await wrapper.setProps({ loading: false })
    expect(wrapper.text()).toBe('内容')
    expect(wrapper.find('.dou-skeleton').exists()).toBe(false)
  })
})
