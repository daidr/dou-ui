import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouResult } from '../../../index'

describe('DouResult', () => {
  it('announces news politely and problems at once', () => {
    expect(mount(DouResult, { props: { status: 'success' } }).attributes('role')).toBe('status')
    expect(mount(DouResult, { props: { status: 'danger' } }).attributes('role')).toBe('alert')
  })

  it('renders title, description, actions and extra', () => {
    const wrapper = mount(DouResult, {
      props: { status: 'warning', title: '部分失败', description: '3 条记录未导入' },
      slots: { default: '<button>重试</button>', extra: '<p>第 4 行：缺少邮箱</p>' },
    })
    expect(wrapper.classes()).toContain('dou-result--warning')
    expect(wrapper.find('.dou-result__title').text()).toBe('部分失败')
    expect(wrapper.find('.dou-result__description').text()).toBe('3 条记录未导入')
    expect(wrapper.find('.dou-result__actions button').exists()).toBe(true)
    expect(wrapper.find('.dou-result__extra').text()).toContain('缺少邮箱')
    expect(wrapper.find('.dou-result__icon').attributes('aria-hidden')).toBe('true')
  })

  it('leaves out what is not given', () => {
    const wrapper = mount(DouResult, { props: { title: '完成' } })
    expect(wrapper.find('.dou-result__description').exists()).toBe(false)
    expect(wrapper.find('.dou-result__actions').exists()).toBe(false)
  })
})
