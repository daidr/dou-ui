import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouConfigProvider, DouSpinner, en } from '../../../index'

describe('DouSpinner', () => {
  it('is a labelled status', () => {
    const wrapper = mount(DouSpinner)
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-label')).toBe('加载中')
    expect(wrapper.classes()).toEqual(['dou-spinner', 'dou-spinner--md'])
  })

  it('takes a custom size and label', () => {
    const wrapper = mount(DouSpinner, { props: { size: 24, label: '正在上传' } })
    expect(wrapper.attributes('style')).toContain('--dou-spinner-size: 24px')
    expect(wrapper.attributes('aria-label')).toBe('正在上传')
  })

  it('reads its default label from the locale', () => {
    const wrapper = mount({
      render: () => h(DouConfigProvider, { locale: en }, () => h(DouSpinner)),
    })
    expect(wrapper.get('.dou-spinner').attributes('aria-label')).toBe('Loading')
  })
})
