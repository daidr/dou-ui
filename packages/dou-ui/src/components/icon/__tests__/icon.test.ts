import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { DouIcon } from '../../../index'

describe('DouIcon', () => {
  it('renders the graphic as decoration by default', () => {
    const wrapper = mount(DouIcon, { slots: { default: () => h('svg') } })
    expect(wrapper.classes()).toContain('dou-icon')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('role')).toBeUndefined()
  })

  it('exposes an accessible name when labelled', () => {
    const wrapper = mount(DouIcon, { props: { label: '搜索' } })
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('搜索')
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
  })

  it('reads a numeric size as pixels', () => {
    const wrapper = mount(DouIcon, { props: { size: 20 } })
    expect(wrapper.attributes('style')).toContain('--dou-icon-size: 20px')
    const em = mount(DouIcon, { props: { size: '1.5em' } })
    expect(em.attributes('style')).toContain('--dou-icon-size: 1.5em')
  })

  it('spins on request', () => {
    expect(mount(DouIcon, { props: { spin: true } }).classes()).toContain('is-spin')
  })
})
