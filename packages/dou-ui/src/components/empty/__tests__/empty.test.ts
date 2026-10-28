import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { DouConfigProvider, DouEmpty, en } from '../../../index'

describe('DouEmpty', () => {
  it('falls back to the locale title', () => {
    const wrapper = mount(DouEmpty)
    expect(wrapper.get('.dou-empty__title').text()).toBe('暂无数据')
    expect(wrapper.get('.dou-empty__icon').attributes('aria-hidden')).toBe('true')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-empty', 'dou-empty--md']))
  })

  it('follows the locale of the config provider', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { locale: en },
      slots: { default: () => h(DouEmpty) },
    })
    expect(wrapper.get('.dou-empty__title').text()).toBe('No data')
  })

  it('shows only the description when one is given without a title', () => {
    const wrapper = mount(DouEmpty, { props: { description: '还没有任何部署' } })
    expect(wrapper.find('.dou-empty__title').exists()).toBe(false)
    expect(wrapper.get('.dou-empty__description').text()).toBe('还没有任何部署')
  })

  it('renders actions and a custom icon', () => {
    const wrapper = mount(DouEmpty, {
      props: { title: '没有项目', size: 'sm' },
      slots: { default: '<button>新建</button>', icon: '<i class="custom" />' },
    })
    expect(wrapper.classes()).toContain('dou-empty--sm')
    expect(wrapper.find('.dou-empty__actions button').text()).toBe('新建')
    expect(wrapper.find('.custom').exists()).toBe(true)
  })
})
