import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouKbd } from '../../../index'

describe('DouKbd', () => {
  it('renders a kbd element', () => {
    const wrapper = mount(DouKbd, { slots: { default: '⌘' } })
    expect(wrapper.element.tagName).toBe('KBD')
    expect(wrapper.text()).toBe('⌘')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-kbd', 'dou-kbd--md']))
  })

  it('applies the size', () => {
    const wrapper = mount(DouKbd, { props: { size: 'sm' }, slots: { default: 'K' } })
    expect(wrapper.classes()).toContain('dou-kbd--sm')
  })
})
