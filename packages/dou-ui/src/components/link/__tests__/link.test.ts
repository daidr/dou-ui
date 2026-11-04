import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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
      props: { href: 'https://example.com', external: true },
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

  it('renders a button when there is no href', async () => {
    const wrapper = mount(DouLink, { slots: { default: '重新开始' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.attributes('href')).toBeUndefined()
    expect(wrapper.classes()).toContain('dou-link')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disables the button natively', () => {
    const wrapper = mount(DouLink, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-disabled')).toBeUndefined()
  })

  it('warns that external does nothing without an href', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouLink, { props: { external: true } })
    expect(wrapper.find('.dou-link__external').exists()).toBe(false)
    expect(wrapper.attributes('target')).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[dou-ui] DouLink'))
    warn.mockRestore()
  })
})
