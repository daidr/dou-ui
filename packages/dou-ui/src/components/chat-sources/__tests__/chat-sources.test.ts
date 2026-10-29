import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatCitation, DouChatSources } from '../../../index'
import { sourceSite } from '../chat-sources'

const items = [
  { title: '上海天气预报', url: 'https://www.weather.sh.cn/forecast' },
  { title: '滨江骑行指南', site: '骑行论坛' },
  { title: '徐汇滨江地图', url: 'https://map.example.com' },
]

describe('DouChatSources', () => {
  it('lists numbered sources and links them', () => {
    const wrapper = mount(DouChatSources, { props: { items } })
    const links = wrapper.findAll('.dou-chat-sources__link')
    expect(links[0]!.element.tagName).toBe('A')
    expect(links[0]!.attributes('href')).toBe('https://www.weather.sh.cn/forecast')
    expect(links[0]!.attributes('rel')).toBe('noopener noreferrer')
    expect(links[0]!.get('.dou-chat-sources__index').text()).toBe('1')
    expect(links[0]!.get('.dou-chat-sources__site').text()).toBe('weather.sh.cn')
    expect(links[1]!.element.tagName).toBe('SPAN')
  })

  it('folds sources past `max`', async () => {
    const wrapper = mount(DouChatSources, { props: { items, max: 1 } })
    expect(wrapper.findAll('.dou-chat-sources__item')).toHaveLength(1)
    const more = wrapper.get('.dou-chat-sources__more')
    expect(more.text()).toBe('+2')
    await more.trigger('click')
    expect(wrapper.findAll('.dou-chat-sources__item')).toHaveLength(3)
  })

  it('names the site', () => {
    expect(sourceSite({ url: 'not a url' })).toBe('')
    expect(sourceSite({ site: 'x', url: 'https://y.com' })).toBe('x')
  })
})

describe('DouChatCitation', () => {
  it('is a labelled link to its source', () => {
    const wrapper = mount(DouChatCitation, { props: { index: 2, source: items[0] } })
    const tag = wrapper.get('.dou-chat-citation')
    expect(tag.text()).toBe('2')
    expect(tag.attributes('aria-label')).toBe('来源 2：上海天气预报')
    expect(tag.attributes('href')).toBe(items[0]!.url)
  })

  it('is a plain number without a source', () => {
    const wrapper = mount(DouChatCitation, { props: { index: 1 } })
    expect(wrapper.text()).toBe('1')
  })
})
