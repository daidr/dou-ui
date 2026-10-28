import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouGrid, DouGridItem } from '../../../index'

const style = (el: Element) => (el as HTMLElement).style

describe('DouGrid', () => {
  it('sets columns and gaps through custom properties', () => {
    const wrapper = mount(DouGrid, { props: { cols: 3, gap: 'lg' } })
    expect(style(wrapper.element).getPropertyValue('--dou-grid-cols')).toBe('3')
    expect(style(wrapper.element).getPropertyValue('--dou-grid-row-gap')).toBe(
      'var(--dou-space-lg)',
    )
  })

  it('spreads responsive columns over the breakpoints', () => {
    const wrapper = mount(DouGrid, { props: { cols: { base: 1, md: 2, xl: 4 }, gap: [8, '1rem'] } })
    const s = style(wrapper.element)
    expect(s.getPropertyValue('--dou-grid-cols')).toBe('1')
    expect(s.getPropertyValue('--dou-grid-cols-md')).toBe('2')
    expect(s.getPropertyValue('--dou-grid-cols-xl')).toBe('4')
    expect(s.getPropertyValue('--dou-grid-cols-sm')).toBe('')
    expect(s.getPropertyValue('--dou-grid-row-gap')).toBe('8px')
    expect(s.getPropertyValue('--dou-grid-column-gap')).toBe('1rem')
  })

  it('fits columns to a minimum width', () => {
    const wrapper = mount(DouGrid, { props: { minItemWidth: 240 } })
    expect(wrapper.classes()).toContain('is-auto-fill')
    expect(style(wrapper.element).getPropertyValue('--dou-grid-min')).toBe('240px')
  })
})

describe('DouGridItem', () => {
  it('spans columns and rows', () => {
    const wrapper = mount(DouGridItem, { props: { span: 2, rowSpan: 3 } })
    expect(style(wrapper.element).getPropertyValue('--dou-grid-column')).toBe('auto / span 2')
    expect(style(wrapper.element).gridRow).toBe('span 3')
  })

  it('carries span and start forward across breakpoints', () => {
    const wrapper = mount(DouGridItem, {
      props: { span: { base: 'full', md: 6 }, start: { lg: 4 } },
    })
    const s = style(wrapper.element)
    expect(s.getPropertyValue('--dou-grid-column')).toBe('1 / -1')
    expect(s.getPropertyValue('--dou-grid-column-md')).toBe('auto / span 6')
    expect(s.getPropertyValue('--dou-grid-column-lg')).toBe('4 / span 6')
    expect(s.getPropertyValue('--dou-grid-column-sm')).toBe('')
  })
})
