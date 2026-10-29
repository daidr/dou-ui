import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouBanner } from '../../../index'

describe('DouBanner', () => {
  it('shows the tone icon, title, message and action', () => {
    const wrapper = mount(DouBanner, {
      props: { tone: 'warning', variant: 'solid', title: '维护通知' },
      slots: { default: () => '今晚 22:00 起暂停服务', action: () => '详情' },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-banner', 'dou-banner--warning', 'dou-banner--solid']),
    )
    expect(wrapper.attributes('aria-label')).toBe('维护通知')
    expect(wrapper.get('.dou-banner__title').text()).toBe('维护通知')
    expect(wrapper.get('.dou-banner__text').text()).toContain('今晚 22:00 起暂停服务')
    expect(wrapper.find('.dou-banner__icon svg').exists()).toBe(true)
    expect(wrapper.get('.dou-banner__action').text()).toBe('详情')
    expect(wrapper.find('.dou-banner__close').exists()).toBe(false)
  })

  it('closes', async () => {
    const wrapper = mount(DouBanner, {
      props: { closable: true },
      slots: { default: () => '新版本已发布' },
    })
    expect(wrapper.attributes('aria-label')).toBe('公告')
    await wrapper.get('.dou-banner__close').trigger('click')
    expect(wrapper.find('.dou-banner').exists()).toBe(false)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('follows `v-model:open`', async () => {
    const wrapper = mount(DouBanner, { props: { open: false } })
    expect(wrapper.find('.dou-banner').exists()).toBe(false)
    await wrapper.setProps({ open: true })
    expect(wrapper.find('.dou-banner').exists()).toBe(true)
  })
})
