import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { DouTimeline, DouTimelineItem } from '../../../index'

describe('DouTimeline', () => {
  it('renders an ordered list of items', () => {
    const wrapper = mount(DouTimeline, {
      slots: {
        default: () => [
          h(DouTimelineItem, { time: '10:00', title: '创建项目' }, () => '由 daidr 创建'),
          h(DouTimelineItem, { time: '10:05', tone: 'success' }, () => '部署成功'),
          h(DouTimelineItem, { title: '等待审核', pending: true }),
        ],
      },
    })
    expect(wrapper.element.tagName).toBe('OL')
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(3)
    expect(items[0]!.find('.dou-timeline__time').text()).toBe('10:00')
    expect(items[0]!.find('.dou-timeline__title').text()).toBe('创建项目')
    expect(items[0]!.find('.dou-timeline__content').text()).toBe('由 daidr 创建')
    expect(items[1]!.classes()).toContain('dou-timeline--success')
    expect(items[1]!.find('.dou-timeline__title').exists()).toBe(false)
    expect(items[2]!.classes()).toContain('is-pending')
    expect(items[2]!.find('.dou-timeline__time').exists()).toBe(false)
    // the rail is decoration
    expect(items[0]!.find('.dou-timeline__rail').attributes('aria-hidden')).toBe('true')
  })

  it('takes a custom dot and the reverse order', () => {
    const wrapper = mount(DouTimeline, {
      props: { reverse: true },
      slots: {
        default: () => h(DouTimelineItem, null, { dot: () => h('svg', { class: 'my-icon' }) }),
      },
    })
    expect(wrapper.classes()).toContain('is-reverse')
    expect(wrapper.find('li').classes()).toContain('is-custom-dot')
    expect(wrapper.find('.dou-timeline__dot .my-icon').exists()).toBe(true)
  })

  it('marks the current step, in place of a custom dot', () => {
    const wrapper = mount(DouTimelineItem, {
      props: { active: true },
      slots: { dot: () => h('svg', { class: 'my-icon' }) },
    })
    expect(wrapper.classes()).toContain('is-active')
    expect(wrapper.classes()).not.toContain('is-custom-dot')
    expect(wrapper.attributes('aria-current')).toBe('step')
    expect(wrapper.find('.my-icon').exists()).toBe(false)
    // the ripple comes from the shared status dot
    expect(wrapper.get('.dou-timeline__dot .dou-status-dot').classes()).toContain('is-ripple')
  })
})
