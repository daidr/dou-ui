import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouCard } from '../../../index'

describe('DouCard', () => {
  it('renders only the parts it is given', () => {
    const wrapper = mount(DouCard, { slots: { default: '内容' } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-card', 'dou-card--padding-md']))
    expect(wrapper.find('.dou-card__body').text()).toBe('内容')
    expect(wrapper.find('.dou-card__header').exists()).toBe(false)
    expect(wrapper.find('.dou-card__footer').exists()).toBe(false)
  })

  it('renders title, description, extra and footer', () => {
    const wrapper = mount(DouCard, {
      props: { title: '生产环境', description: '最近一次部署于 3 分钟前' },
      slots: { extra: '<button>更多</button>', footer: '<button>访问</button>' },
    })
    expect(wrapper.find('.dou-card__title').text()).toBe('生产环境')
    expect(wrapper.find('.dou-card__description').text()).toBe('最近一次部署于 3 分钟前')
    expect(wrapper.find('.dou-card__extra button').exists()).toBe(true)
    expect(wrapper.find('footer.dou-card__footer').text()).toBe('访问')
  })

  it('lets the header slot replace the title', () => {
    const wrapper = mount(DouCard, {
      props: { title: '不会显示' },
      slots: { header: '<h3>自定义</h3>' },
    })
    expect(wrapper.find('.dou-card__title').exists()).toBe(false)
    expect(wrapper.find('h3').text()).toBe('自定义')
  })

  it('applies padding, raised, interactive and the root element', () => {
    const wrapper = mount(DouCard, {
      props: { padding: 'none', raised: true, interactive: true, as: 'article' },
    })
    expect(wrapper.element.tagName).toBe('ARTICLE')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-card--padding-none', 'is-raised', 'is-interactive']),
    )
  })

  it('renders as a button with only text-level parts inside', () => {
    const wrapper = mount(DouCard, {
      props: { as: 'button', title: '上海', description: '戴兜的产物' },
      slots: { default: '正文', footer: '底部' },
    })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.classes()).toContain('is-interactive')
    expect(wrapper.find('div, header, footer').exists()).toBe(false)
    expect(
      wrapper.findAll('span.dou-card__header, span.dou-card__body, span.dou-card__footer'),
    ).toHaveLength(3)
    expect(wrapper.find('.dou-card__title').text()).toBe('上海')
  })

  it('lets a type attribute replace the button default', () => {
    const wrapper = mount(DouCard, { props: { as: 'button' }, attrs: { type: 'submit' } })
    expect(wrapper.attributes('type')).toBe('submit')
  })

  it('keeps block parts for other elements', () => {
    const wrapper = mount(DouCard, { props: { as: 'a', title: '上海' }, slots: { footer: '底部' } })
    expect(wrapper.find('header.dou-card__header').exists()).toBe(true)
    expect(wrapper.find('footer.dou-card__footer').exists()).toBe(true)
    expect(wrapper.attributes('type')).toBeUndefined()
  })
})
