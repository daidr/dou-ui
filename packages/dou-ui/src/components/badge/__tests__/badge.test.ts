import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouBadge } from '../../../index'

describe('DouBadge', () => {
  it('pins a count to the corner of its content', () => {
    const wrapper = mount(DouBadge, {
      props: { value: 5 },
      slots: { default: '<button>通知</button>' },
    })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-badge', 'dou-badge--top-end']))
    const mark = wrapper.get('sup.dou-badge__mark')
    expect(mark.text()).toBe('5')
    expect(mark.classes()).toContain('dou-badge--neutral')
  })

  it('caps the count at max', () => {
    const wrapper = mount(DouBadge, { props: { value: 120 } })
    expect(wrapper.text()).toBe('99+')
    expect(wrapper.classes()).toContain('is-standalone')
  })

  it('hides zero unless showZero', async () => {
    const wrapper = mount(DouBadge, { props: { value: 0 }, slots: { default: 'x' } })
    expect(wrapper.find('.dou-badge__mark').exists()).toBe(false)
    await wrapper.setProps({ showZero: true })
    expect(wrapper.get('.dou-badge__mark').text()).toBe('0')
  })

  it('renders a dot, hidden from screen readers without a label', async () => {
    const wrapper = mount(DouBadge, {
      props: { dot: true, tone: 'danger' },
      slots: { default: 'x' },
    })
    const mark = wrapper.get('.dou-badge__mark')
    expect(mark.classes()).toEqual(expect.arrayContaining(['is-dot', 'dou-badge--danger']))
    expect(mark.text()).toBe('')
    expect(mark.attributes('aria-hidden')).toBe('true')
    await wrapper.setProps({ label: '有新消息' })
    expect(wrapper.get('.dou-badge__mark').attributes('aria-label')).toBe('有新消息')
  })

  it('hides the mark but keeps the content', () => {
    const wrapper = mount(DouBadge, {
      props: { value: 3, hidden: true },
      slots: { default: '内容' },
    })
    expect(wrapper.text()).toBe('内容')
    expect(wrapper.find('.dou-badge__mark').exists()).toBe(false)
  })
})
