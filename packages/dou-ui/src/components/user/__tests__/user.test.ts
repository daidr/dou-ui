import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouUser } from '../../../index'

describe('DouUser', () => {
  it('shows the avatar, name and description', () => {
    const wrapper = mount(DouUser, {
      props: { name: '陈晓', description: '前端工程师', avatar: 'a.png', size: 'lg' },
    })
    expect(wrapper.classes()).toContain('dou-user--lg')
    expect(wrapper.get('.dou-user__name').text()).toBe('陈晓')
    expect(wrapper.get('.dou-user__description').text()).toBe('前端工程师')
    expect(wrapper.get('.dou-avatar').classes()).toContain('dou-avatar--lg')
    expect(wrapper.get('img').attributes('src')).toBe('a.png')
  })

  it('falls back to initials, takes avatar props and slots', () => {
    const wrapper = mount(DouUser, {
      props: { name: 'Ada Lovelace', avatar: { shape: 'square' } },
      slots: { default: () => '⋯' },
    })
    expect(wrapper.get('.dou-avatar').text()).toBe('AL')
    expect(wrapper.find('.dou-user__description').exists()).toBe(false)
    expect(wrapper.get('.dou-user__extra').text()).toBe('⋯')
  })
})
