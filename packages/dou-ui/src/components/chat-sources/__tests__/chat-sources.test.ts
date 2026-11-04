import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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

  it('does not link unsafe addresses', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChatSources, {
      props: {
        items: [
          { title: '坏链接', url: 'javascript:alert(1)' },
          { title: '相对', url: '/a' },
        ],
      },
    })
    const links = wrapper.findAll('.dou-chat-sources__link')
    expect(links[0]!.element.tagName).toBe('SPAN')
    expect(links[0]!.attributes('href')).toBeUndefined()
    expect(links[1]!.attributes('href')).toBe('/a')
    expect(warn.mock.calls[0]![0]).toContain('[dou-ui] DouChatSources:')
    warn.mockRestore()
  })

  it('opens web links in a new tab but not mailto or tel', () => {
    const wrapper = mount(DouChatSources, {
      props: {
        items: [
          { title: '邮件', url: 'mailto:daidr@daidr.me' },
          { title: '网页', url: '/a' },
        ],
      },
    })
    const links = wrapper.findAll('.dou-chat-sources__link')
    expect(links[0]!.attributes('href')).toBe('mailto:daidr@daidr.me')
    expect(links[0]!.attributes('target')).toBeUndefined()
    expect(links[0]!.attributes('rel')).toBeUndefined()
    expect(links[1]!.attributes('target')).toBe('_blank')
  })

  it('names the site', () => {
    expect(sourceSite({ url: 'not a url' })).toBe('')
    expect(sourceSite({ site: 'x', url: 'https://y.com' })).toBe('x')
  })
})

describe('DouChatCitation', () => {
  it('is a labelled link to its source', () => {
    const wrapper = mount(DouChatCitation, {
      props: { index: 2, source: items[0] },
    })
    const tag = wrapper.get('.dou-chat-citation')
    expect(tag.text()).toBe('2')
    expect(tag.attributes('aria-label')).toBe('来源 2：上海天气预报')
    expect(tag.attributes('href')).toBe(items[0]!.url)
  })

  it('does not link unsafe addresses', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChatCitation, {
      props: {
        index: 1,
        source: { title: '坏链接', url: ' JavaScript:alert(1)' },
      },
    })
    const tag = wrapper.get('.dou-chat-citation')
    expect(tag.element.tagName).toBe('SPAN')
    expect(tag.attributes('href')).toBeUndefined()
    expect(tag.attributes('tabindex')).toBe('0')
    expect(warn.mock.calls[0]![0]).toContain('[dou-ui] DouChatCitation:')
    warn.mockRestore()
  })

  it('does not open tel links in a new tab', () => {
    const wrapper = mount(DouChatCitation, {
      props: { index: 1, source: { title: '电话', url: 'tel:+8621000000' } },
    })
    const tag = wrapper.get('.dou-chat-citation')
    expect(tag.attributes('href')).toBe('tel:+8621000000')
    expect(tag.attributes('target')).toBeUndefined()
  })

  it('is a plain number without a source', () => {
    const wrapper = mount(DouChatCitation, { props: { index: 1 } })
    expect(wrapper.text()).toBe('1')
  })
})
