import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouText } from '../../../index'

describe('DouText', () => {
  it('renders a span with default classes', () => {
    const wrapper = mount(DouText, { slots: { default: '正文' } })
    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.text()).toBe('正文')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-text', 'dou-text--default', 'dou-text--neutral']),
    )
  })

  it('inherits size and weight unless set', () => {
    const plain = mount(DouText)
    expect(plain.classes().some((name) => /--(sm|md|lg|regular|medium|bold)$/.test(name))).toBe(
      false,
    )
    const set = mount(DouText, { props: { size: 'sm', weight: 'bold' } })
    expect(set.classes()).toEqual(expect.arrayContaining(['dou-text--sm', 'dou-text--bold']))
  })

  it('combines variant and tone', () => {
    const wrapper = mount(DouText, { props: { variant: 'secondary', tone: 'danger' } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-text--secondary', 'dou-text--danger']),
    )
  })

  it('renders the requested element', () => {
    expect(mount(DouText, { props: { as: 'p' } }).element.tagName).toBe('P')
  })

  it('truncates to one line or clamps to many', () => {
    expect(mount(DouText, { props: { truncate: true } }).classes()).toContain('is-truncate')
    const clamp = mount(DouText, { props: { truncate: 3 } })
    expect(clamp.classes()).toContain('is-clamp')
    expect(clamp.attributes('style')).toContain('--dou-text-lines: 3')
  })

  it('switches to the monospace font', () => {
    expect(mount(DouText, { props: { mono: true } }).classes()).toContain('is-mono')
  })
})
