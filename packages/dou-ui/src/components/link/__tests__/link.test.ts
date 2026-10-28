import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouLink } from '../../../index'

describe('DouLink', () => {
  it('renders an anchor with defaults', () => {
    const wrapper = mount(DouLink, { props: { href: '/docs' }, slots: { default: '文档' } })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/docs')
    expect(wrapper.text()).toBe('文档')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-link', 'dou-link--neutral', 'dou-link--underline-always']),
    )
  })

  it('opens external links safely in a new tab', () => {
    const wrapper = mount(DouLink, { props: { href: 'https://example.com', external: true } })
    expect(wrapper.attributes('target')).toBe('_blank')
    expect(wrapper.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.find('.dou-link__external').exists()).toBe(true)
  })

  it('lets the trailing slot replace the external arrow', () => {
    const wrapper = mount(DouLink, {
      props: { external: true },
      slots: { trailing: '→' },
    })
    expect(wrapper.find('.dou-link__external').exists()).toBe(false)
    expect(wrapper.text()).toContain('→')
  })

  it('drops the href and swallows clicks when disabled', async () => {
    const wrapper = mount(DouLink, { props: { href: '/docs', disabled: true } })
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('emits click', async () => {
    const wrapper = mount(DouLink, { props: { href: '#' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
