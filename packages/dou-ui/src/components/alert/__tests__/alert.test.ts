import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouAlert } from '../../../index'

describe('DouAlert', () => {
  it('uses a polite role for calm tones and alert for urgent ones', () => {
    expect(mount(DouAlert, { props: { tone: 'success' } }).attributes('role')).toBe('status')
    expect(mount(DouAlert, { props: { tone: 'danger' } }).attributes('role')).toBe('alert')
    expect(mount(DouAlert, { props: { tone: 'warning' } }).attributes('role')).toBe('alert')
  })

  it('renders a title, description, icon and action', () => {
    const wrapper = mount(DouAlert, {
      props: { tone: 'primary', title: '新版本' },
      slots: { default: '已发布 1.0', action: '<a href="#">查看</a>' },
    })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-alert--primary', 'is-titled']))
    expect(wrapper.get('.dou-alert__title').text()).toBe('新版本')
    expect(wrapper.get('.dou-alert__description').text()).toBe('已发布 1.0')
    expect(wrapper.find('.dou-alert__icon svg').exists()).toBe(true)
    expect(wrapper.find('.dou-alert__action a').exists()).toBe(true)
  })

  it('can hide its icon', () => {
    const wrapper = mount(DouAlert, { props: { showIcon: false }, slots: { default: '提示' } })
    expect(wrapper.find('.dou-alert__icon').exists()).toBe(false)
  })

  it('closes itself from the close button', async () => {
    const wrapper = mount(DouAlert, { props: { closable: true }, slots: { default: '提示' } })
    const close = wrapper.get('.dou-alert__close')
    expect(close.attributes('aria-label')).toBe('关闭')
    await close.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.find('.dou-alert').exists()).toBe(false)
  })
})
