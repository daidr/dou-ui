import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { DouChatToolCall } from '../../../index'
import { formatToolValue } from '../chat-tool-call'

describe('DouChatToolCall', () => {
  it('shows the name and status, and opens to the input and output', async () => {
    const wrapper = mount(DouChatToolCall, {
      props: { name: 'get_weather', input: { city: '上海' }, output: '晴，22°C' },
    })
    expect(wrapper.classes()).toContain('dou-chat-tool-call--done')
    expect(wrapper.get('.dou-chat-tool-call__name').text()).toBe('get_weather')
    expect(wrapper.get('.dou-chat-tool-call__status').text()).toBe('已完成')
    const header = wrapper.get('.dou-chat-tool-call__header')
    expect(header.element.tagName).toBe('BUTTON')
    expect(header.attributes('aria-expanded')).toBe('false')

    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('true')
    expect(wrapper.emitted('update:open')).toEqual([[true]])
    const codes = wrapper.findAll('.dou-chat-tool-call__code')
    expect(codes[0]!.text()).toBe('{\n  "city": "上海"\n}')
    expect(codes[1]!.text()).toBe('晴，22°C')
  })

  it('is a plain header with nothing to expand', () => {
    const wrapper = mount(DouChatToolCall, {
      props: { title: '正在搜索网页', status: 'running' },
    })
    const header = wrapper.get('.dou-chat-tool-call__header')
    expect(header.element.tagName).toBe('DIV')
    expect(header.text()).toContain('正在搜索网页')
    expect(header.text()).toContain('运行中')
    expect(wrapper.find('.dou-spinner').exists()).toBe(true)
  })

  it('shows actions for a waiting call', () => {
    const wrapper = mount(DouChatToolCall, {
      props: { name: 'delete_file', status: 'waiting' },
      slots: { actions: () => '允许' },
    })
    expect(wrapper.classes()).toContain('dou-chat-tool-call--waiting')
    expect(wrapper.get('.dou-chat-tool-call__status').text()).toBe('等待中')
    expect(wrapper.get('.dou-chat-tool-call__actions').text()).toBe('允许')
  })

  it('tells a call that has not started from one that is waiting', () => {
    const wrapper = mount(DouChatToolCall, { props: { name: 'read_file', status: 'pending' } })
    expect(wrapper.classes()).toContain('dou-chat-tool-call--pending')
    expect(wrapper.get('.dou-chat-tool-call__status').text()).toBe('未开始')
  })

  it('formats values', () => {
    expect(formatToolValue('a')).toBe('a')
    expect(formatToolValue([1])).toBe('[\n  1\n]')
    expect(formatToolValue(undefined)).toBe('undefined')
  })

  it('warns about a pending call that offers allow buttons, and about old names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(DouChatToolCall, {
      props: { name: 'delete_file', status: 'pending' },
      slots: { actions: () => '允许' },
    })
    mount(DouChatToolCall, { props: { name: 'read_file', status: 'success' as never } })
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      '[dou-ui] DouChatToolCall: `pending` now means not started; use `waiting` for a call that waits for approval.',
      '[dou-ui] DouChatToolCall: unknown status `success`, expected one of `pending`, `running`, `waiting`, `done`, `error`. Use `done`.',
    ])
    warn.mockRestore()
  })
})
