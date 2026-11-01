import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { DouChart, DouChartAxis, DouChartBar, DouChartLine, DouChartPie, DouChartScatter } from '..'

const sales = [
  { q: '一季度', a: 120, b: 90 },
  { q: '二季度', a: 150, b: null },
  { q: '三季度', a: 140, b: 110 },
]

async function mounted(slots: () => unknown, props: Record<string, unknown> = {}) {
  const wrapper = mount(DouChart, {
    props: { data: sales, x: 'q', table: true, ...props },
    slots: { default: slots as never },
    attachTo: document.body,
  })
  await nextTick()
  await nextTick()
  return wrapper
}

const cells = (wrapper: Awaited<ReturnType<typeof mounted>>) =>
  wrapper.findAll('.dou-chart__table tr').map((tr) => tr.findAll('th, td').map((c) => c.text()))

describe('table view', () => {
  it('writes each x as a row and each series as a column, as the axes format them', async () => {
    const wrapper = await mounted(() => [
      h(DouChartAxis, { for: 'x', title: '季度' }),
      h(DouChartAxis, { for: 'y', format: (v: number) => `${v} 件` }),
      h(DouChartBar, { y: 'a', name: '线上' }),
      h(DouChartLine, { y: 'b', name: '门店' }),
    ])
    expect(cells(wrapper)).toEqual([
      ['季度', '线上', '门店'],
      ['一季度', '120 件', '90 件'],
      ['二季度', '150 件', ''],
      ['三季度', '140 件', '110 件'],
    ])
    expect(wrapper.find('caption').text()).toBe('图表数据')
    expect(wrapper.find('th[scope="row"]').exists()).toBe(true)
    // the chart's own keys and tooltip are off while the table shows
    expect(wrapper.find('.dou-chart').classes()).toContain('is-table')
    expect(wrapper.find('.dou-chart').attributes('tabindex')).toBeUndefined()
    await wrapper.find('.dou-chart__table').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:table')).toEqual([[false]])
    wrapper.unmount()
  })

  it('lists a pie’s slices with their shares, and a scatter’s points one by one', async () => {
    const pie = await mounted(() => [h(DouChartPie, { value: 'a', name: '销售额' })], {
      ariaLabel: '各季度销售额',
    })
    expect(cells(pie)[0]).toEqual(['q', '销售额', '占比'])
    expect(cells(pie)[1]).toEqual(['一季度', '120', '29.3%'])
    expect(pie.find('caption').text()).toBe('各季度销售额')
    pie.unmount()
    const points = [
      { w: 1, h: 2 },
      { w: 3, h: 4 },
    ]
    const scatter = await mounted(() => [h(DouChartScatter, { y: 'h', name: '样本' })], {
      data: points,
      x: 'w',
    })
    expect(cells(scatter)).toEqual([
      ['系列', 'w', '值'],
      ['样本', '1', '2'],
      ['样本', '3', '4'],
    ])
    scatter.unmount()
  })

  it('cuts a long table short, and says so', async () => {
    const data = Array.from({ length: 1200 }, (_, i) => ({ i, v: i }))
    const wrapper = await mounted(() => [h(DouChartLine, { y: 'v' })], { data, x: 'i' })
    expect(wrapper.findAll('.dou-chart__table tbody tr')).toHaveLength(1000)
    expect(wrapper.find('.dou-chart__table-more').text()).toBe('只显示前 1,000 行，共 1,200 行')
    wrapper.unmount()
  })
})
