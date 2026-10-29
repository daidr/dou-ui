import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouHighlight, splitHighlight } from '../../../index'

const marked = (parts: { text: string; match: boolean }[]) =>
  parts.map((part) => (part.match ? `[${part.text}]` : part.text)).join('')

describe('splitHighlight', () => {
  it('marks every match, ignoring case', () => {
    expect(marked(splitHighlight('Vue 组件库 vue', 'vue'))).toBe('[Vue] 组件库 [vue]')
    expect(marked(splitHighlight('Vue vue', 'vue', { caseSensitive: true }))).toBe('Vue [vue]')
  })

  it('takes several keywords, longer ones first', () => {
    expect(marked(splitHighlight('上海市浦东新区', ['上海', '上海市', '浦东']))).toBe(
      '[上海市][浦东]新区',
    )
  })

  it('treats keywords as plain text', () => {
    expect(marked(splitHighlight('a+b=c (d) dou-ui', ['a+b', '(d)', 'dou-ui']))).toBe(
      '[a+b]=c [(d)] [dou-ui]',
    )
  })

  it('matches whole words only when asked', () => {
    expect(marked(splitHighlight('cat category cat', 'cat', { wholeWord: true }))).toBe(
      '[cat] category [cat]',
    )
  })

  it('leaves the text alone without keywords', () => {
    expect(splitHighlight('文本', ['', '  '])).toEqual([{ text: '文本', match: false }])
    expect(splitHighlight('', 'a')).toEqual([])
  })
})

describe('DouHighlight', () => {
  it('wraps matches in mark', () => {
    const wrapper = mount(DouHighlight, { props: { text: '戴兜的组件库', keywords: '组件' } })
    expect(wrapper.text()).toBe('戴兜的组件库')
    expect(wrapper.findAll('mark').map((mark) => mark.text())).toEqual(['组件'])
    expect(wrapper.get('mark').classes()).toContain('dou-highlight__mark')
  })

  it('renders marks through the slot', () => {
    const wrapper = mount(DouHighlight, {
      props: { text: 'a b a', keywords: 'a' },
      slots: { mark: ({ text }: { text: string }) => h('strong', text) },
    })
    expect(wrapper.findAll('strong')).toHaveLength(2)
    expect(wrapper.find('mark').exists()).toBe(false)
  })
})
