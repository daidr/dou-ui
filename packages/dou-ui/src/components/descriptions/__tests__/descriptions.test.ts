import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { DouDescriptions, DouDescriptionsItem } from '../../../index'

describe('DouDescriptions', () => {
  it('renders items as a description list', () => {
    const wrapper = mount(DouDescriptions, {
      props: { title: '实例' },
      slots: {
        default: () => [
          h(DouDescriptionsItem, { label: '区域' }, () => '上海'),
          h(DouDescriptionsItem, { label: '规格' }, () => '2 vCPU'),
        ],
      },
    })
    expect(wrapper.get('.dou-descriptions__title').text()).toBe('实例')
    expect(wrapper.find('dl').exists()).toBe(true)
    const labels = wrapper.findAll('dt').map((node) => node.text())
    const values = wrapper.findAll('dd').map((node) => node.text())
    expect(labels).toEqual(['区域', '规格'])
    expect(values).toEqual(['上海', '2 vCPU'])
    expect(wrapper.attributes('style')).toContain('--dou-descriptions-columns: 3')
  })

  it('applies layout, variant, columns and label width', () => {
    const wrapper = mount(DouDescriptions, {
      props: { layout: 'horizontal', variant: 'table', columns: 2, labelWidth: 80 },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-descriptions--horizontal', 'dou-descriptions--table']),
    )
    expect(wrapper.attributes('style')).toContain('--dou-descriptions-columns: 2')
    expect(wrapper.attributes('style')).toContain('--dou-descriptions-label-width: 80px')
    expect(wrapper.find('.dou-descriptions__header').exists()).toBe(false)
  })

  it('spans columns, capped at the column count', () => {
    const wrapper = mount(DouDescriptions, {
      props: { columns: 2 },
      slots: {
        default: () => [
          h(DouDescriptionsItem, { label: 'a', span: 5 }),
          h(DouDescriptionsItem, { label: 'b', span: 'fill' }),
          h(DouDescriptionsItem, { label: 'c' }),
        ],
      },
    })
    const items = wrapper.findAll('.dou-descriptions__item')
    expect(items[0]!.attributes('style')).toContain('grid-column-end: span 2')
    expect(items[1]!.attributes('style')).toContain('grid-column: 1 / -1')
    expect(items[2]!.attributes('style')).toBeUndefined()
  })

  it('renders the label slot', () => {
    const wrapper = mount(DouDescriptionsItem, {
      slots: { label: '<b>状态</b>', default: '运行中' },
    })
    expect(wrapper.find('dt b').text()).toBe('状态')
  })
})
