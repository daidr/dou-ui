import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { DouAvatar, DouAvatarGroup } from '../../../index'

describe('DouAvatar', () => {
  it('shows the image with its alt text', () => {
    const wrapper = mount(DouAvatar, { props: { src: '/a.png', name: 'Ada Lovelace' } })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe('/a.png')
    expect(img.attributes('alt')).toBe('Ada Lovelace')
    expect(wrapper.attributes('role')).toBeUndefined()
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-avatar', 'dou-avatar--md', 'dou-avatar--circle', 'is-image']),
    )
  })

  it('falls back to the initials when the image fails', async () => {
    const wrapper = mount(DouAvatar, { props: { src: '/broken.png', name: 'Ada Lovelace' } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.dou-avatar__initials').text()).toBe('AL')
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('Ada Lovelace')
  })

  it('tries a new src again after a failure', async () => {
    const wrapper = mount(DouAvatar, { props: { src: '/broken.png', name: 'Ada' } })
    await wrapper.get('img').trigger('error')
    await wrapper.setProps({ src: '/b.png' })
    expect(wrapper.get('img').attributes('src')).toBe('/b.png')
  })

  it('uses one character for a CJK name', () => {
    const wrapper = mount(DouAvatar, { props: { name: '林小满' } })
    expect(wrapper.find('.dou-avatar__initials').text()).toBe('林')
  })

  it('shows an icon without a name and hides it from screen readers', () => {
    const wrapper = mount(DouAvatar)
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('accepts a size in px and the square shape', () => {
    const wrapper = mount(DouAvatar, { props: { name: 'A', size: 56, shape: 'square' } })
    expect(wrapper.attributes('style')).toContain('--dou-avatar-size: 56px')
    expect(wrapper.classes()).toContain('dou-avatar--square')
  })
})

const avatars = (count: number) =>
  Array.from({ length: count }, (_, i) => h(DouAvatar, { name: `User ${i}` }))

describe('DouAvatarGroup', () => {
  it('passes size and shape down to its avatars', () => {
    const wrapper = mount(DouAvatarGroup, {
      props: { size: 'sm', shape: 'square' },
      slots: { default: () => avatars(2) },
    })
    expect(wrapper.attributes('role')).toBe('group')
    const items = wrapper.findAll('.dou-avatar')
    expect(items).toHaveLength(2)
    for (const item of items) {
      expect(item.classes()).toEqual(
        expect.arrayContaining(['dou-avatar--sm', 'dou-avatar--square']),
      )
    }
  })

  it('collapses avatars beyond max into a count', () => {
    const wrapper = mount(DouAvatarGroup, {
      props: { max: 3 },
      slots: { default: () => avatars(5) },
    })
    expect(wrapper.findAll('.dou-avatar')).toHaveLength(4)
    expect(wrapper.get('.dou-avatar-group__rest').text()).toBe('+2')
  })
})
