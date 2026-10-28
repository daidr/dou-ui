import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouBreadcrumb } from '../../../index'

const items = [
  { label: '首页', href: '/' },
  { label: '项目', href: '/projects' },
  { label: 'dou-ui', href: '/projects/dou-ui' },
  { label: '部署' },
  { label: '39dc86b' },
]

describe('DouBreadcrumb', () => {
  it('renders a labelled navigation with the last item as the current page', () => {
    const wrapper = mount(DouBreadcrumb, { props: { items } })
    expect(wrapper.element.tagName).toBe('NAV')
    expect(wrapper.attributes('aria-label')).toBe('面包屑')
    expect(wrapper.findAll('li')).toHaveLength(5)
    expect(wrapper.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/',
      '/projects',
      '/projects/dou-ui',
    ])
    const current = wrapper.get('[aria-current="page"]')
    expect(current.text()).toBe('39dc86b')
    expect(current.element.tagName).toBe('SPAN')
    expect(wrapper.findAll('.dou-breadcrumb__separator')).toHaveLength(4)
    expect(wrapper.get('.dou-breadcrumb__separator').attributes('aria-hidden')).toBe('true')
  })

  it('makes items without href buttons that emit navigate', async () => {
    const wrapper = mount(DouBreadcrumb, { props: { items } })
    const button = wrapper.get('button')
    expect(button.text()).toBe('部署')
    await button.trigger('click')
    const [item, index] = wrapper.emitted('navigate')![0]!
    expect(item).toEqual({ label: '部署' })
    expect(index).toBe(3)
  })

  it('collapses the middle of a long path and expands it', async () => {
    const wrapper = mount(DouBreadcrumb, { props: { items, maxItems: 3 } })
    expect(wrapper.findAll('li').map((li) => li.text().replace('/', '').trim())).toEqual([
      '首页',
      '…',
      '部署',
      '39dc86b',
    ])
    const ellipsis = wrapper.get('.dou-breadcrumb__ellipsis')
    expect(ellipsis.attributes('aria-label')).toBe('显示完整路径')
    await ellipsis.trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(5)
  })

  it('accepts a custom separator and item slot', () => {
    const wrapper = mount(DouBreadcrumb, {
      props: { items: items.slice(0, 2), separator: '›' },
      slots: {
        item: ({ item, current }: { item: { label: string }; current: boolean }) =>
          `${item.label}${current ? '!' : ''}`,
      },
    })
    expect(wrapper.get('.dou-breadcrumb__separator').text()).toBe('›')
    expect(wrapper.findAll('li')[1]!.text()).toContain('项目!')
  })
})
