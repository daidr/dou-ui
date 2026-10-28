import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouSpace } from '../../../index'

describe('DouSpace', () => {
  it('lays items out horizontally with the medium gap', () => {
    const wrapper = mount(DouSpace, { slots: { default: '<i>a</i><i>b</i>' } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        'dou-space',
        'dou-space--horizontal',
        'dou-space--md',
        'dou-space--align-center',
      ]),
    )
    expect(wrapper.findAll('i')).toHaveLength(2)
  })

  it('stretches items when vertical', () => {
    const wrapper = mount(DouSpace, { props: { direction: 'vertical' } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-space--vertical', 'dou-space--align-stretch']),
    )
  })

  it('accepts any length as the gap', () => {
    const px = mount(DouSpace, { props: { size: 24 } })
    expect(px.attributes('style')).toContain('--dou-space-gap: 24px')
    expect(px.classes()).not.toContain('dou-space--md')
    const rem = mount(DouSpace, { props: { size: '2rem' } })
    expect(rem.attributes('style')).toContain('--dou-space-gap: 2rem')
  })

  it('supports wrap, justify and block', () => {
    const wrapper = mount(DouSpace, { props: { wrap: true, justify: 'between', block: true } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['is-wrap', 'is-block', 'dou-space--justify-between']),
    )
  })
})
