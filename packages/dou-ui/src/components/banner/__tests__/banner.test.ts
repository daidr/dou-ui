import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouBanner } from '../../../index'

afterEach(() => localStorage.clear())

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

  it('closes, and remembers it under `storageKey`', async () => {
    const wrapper = mount(DouBanner, {
      props: { closable: true, storageKey: 'notice-v2' },
      slots: { default: () => '新版本已发布' },
    })
    expect(wrapper.attributes('aria-label')).toBe('公告')
    await wrapper.get('.dou-banner__close').trigger('click')
    expect(wrapper.find('.dou-banner').exists()).toBe(false)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(localStorage.getItem('notice-v2')).toBe('closed')

    const again = mount(DouBanner, { props: { storageKey: 'notice-v2' } })
    await nextTick()
    expect(again.find('.dou-banner').exists()).toBe(false)
    const other = mount(DouBanner, { props: { storageKey: 'notice-v3' } })
    await nextTick()
    expect(other.find('.dou-banner').exists()).toBe(true)
  })

  it('follows `v-model:open`', async () => {
    const wrapper = mount(DouBanner, { props: { open: false } })
    expect(wrapper.find('.dou-banner').exists()).toBe(false)
    await wrapper.setProps({ open: true })
    expect(wrapper.find('.dou-banner').exists()).toBe(true)
  })
})
