import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouProgressGroup } from '../../../index'

const items = [
  { label: '图片', value: 30 },
  { label: '视频', value: 50, tone: 'danger' as const },
  { label: '文档', value: 20, color: 'rgb(1, 2, 3)' },
]

describe('DouProgressGroup', () => {
  it('fills the bar with the parts by default', () => {
    const wrapper = mount(DouProgressGroup, { props: { items } })
    const segments = wrapper.findAll('[role="meter"]')
    expect(segments.map((segment) => segment.attributes('style'))).toEqual([
      expect.stringContaining('width: 30%'),
      expect.stringContaining('width: 50%'),
      expect.stringContaining('width: 20%'),
    ])
    expect(segments[0]!.attributes('style')).toContain('var(--dou-color-primary)')
    expect(segments[1]!.attributes('style')).toContain('var(--dou-color-danger)')
    expect(segments[2]!.attributes('style')).toContain('rgb(1, 2, 3)')
    expect(segments[1]!.attributes()).toMatchObject({
      'aria-label': '视频',
      'aria-valuenow': '50',
      'aria-valuemax': '100',
      'aria-valuetext': '50%',
    })
  })

  it('measures against max and lists a legend', () => {
    const wrapper = mount(DouProgressGroup, {
      props: { items, max: 200, legend: true, format: (value: number) => `${value} GB` },
    })
    expect(wrapper.get('[role="meter"]').attributes('style')).toContain('width: 15%')
    expect(wrapper.findAll('.dou-progress-group__legend-item').map((item) => item.text())).toEqual([
      '图片30 GB',
      '视频50 GB',
      '文档20 GB',
    ])
  })

  it('skips empty parts in the bar', () => {
    const wrapper = mount(DouProgressGroup, { props: { items: [{ value: 0 }, { value: 4 }] } })
    expect(wrapper.findAll('[role="meter"]')).toHaveLength(1)
  })
})
