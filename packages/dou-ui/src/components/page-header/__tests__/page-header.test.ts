import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { DouPageHeader } from '../../../index'

describe('DouPageHeader', () => {
  it('renders a back button, the title and the subtitle', async () => {
    const wrapper = mount(DouPageHeader, { props: { title: '订单详情', subtitle: 'SH-2048' } })
    expect(wrapper.element.tagName).toBe('HEADER')
    expect(wrapper.get('h1').text()).toBe('订单详情')
    expect(wrapper.get('.dou-page-header__subtitle').text()).toBe('SH-2048')
    const back = wrapper.get('button')
    expect(back.text()).toBe('返回')
    await back.trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('drops the back button and follows the heading level', () => {
    const wrapper = mount(DouPageHeader, { props: { title: '设置', showBack: false, level: 2 } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('h2').text()).toBe('设置')
  })

  it('places the breadcrumb, extra and content slots', () => {
    const wrapper = mount(DouPageHeader, {
      props: { title: '项目', backText: '上一页' },
      slots: {
        breadcrumb: () => h('nav', '首页 / 项目'),
        extra: () => h('button', '编辑'),
        default: () => '上海研发中心的项目。',
      },
    })
    expect(wrapper.get('.dou-page-header__breadcrumb').text()).toBe('首页 / 项目')
    expect(wrapper.get('.dou-page-header__extra').text()).toBe('编辑')
    expect(wrapper.get('.dou-page-header__content').text()).toBe('上海研发中心的项目。')
    expect(wrapper.get('.dou-page-header__back').text()).toBe('上一页')
  })
})
