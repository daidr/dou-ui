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
})
