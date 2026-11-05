import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouChatMessage, DouConfigProvider } from '../../../index'
import { messageText } from '../chat-message'

describe('DouChatMessage', () => {
  it('renders each kind of part in order', () => {
    const wrapper = mount(DouChatMessage, {
      props: {
        parts: [
          { type: 'reasoning', text: '想一想', duration: 3 },
          { type: 'steps', items: [{ label: '搜索网页' }] },
          { type: 'plan', items: [{ label: '查天气', status: 'done' }] },
          { type: 'tool', name: 'get_weather' },
          { type: 'text', text: '周六适合骑车。' },
          { type: 'sources', items: [{ title: '天气', url: 'https://weather.example.com' }] },
          { type: 'artifact', title: '计划.md' },
          { type: 'confirm', title: '发送邮件？', detail: 'to: 戴兜' },
          { type: 'chart', data: [1, 2] },
        ],
      },
      slots: {
        part: ({ part }: { part: { type: string } }) => h('i', { class: 'custom' }, part.type),
      },
    })
    const content = wrapper.get('.dou-chat-message__content')
    const blocks = content.element.children
    expect([...blocks].map((el) => el.className.split(' ')[0])).toEqual([
      'dou-chat-reasoning',
      'dou-chat-steps',
      'dou-chat-plan',
      'dou-chat-tool-call',
      'dou-stream-text',
      'dou-chat-sources',
      'dou-chat-artifact',
      'dou-chat-confirm',
      'custom',
    ])
    expect(wrapper.get('.dou-chat-message__code').text()).toBe('to: 戴兜')
  })

  it('passes collapsible through to a plan part', () => {
    const wrapper = mount(DouChatMessage, {
      props: { parts: [{ type: 'plan', items: [{ label: '查天气' }], collapsible: false }] },
    })
    expect(wrapper.get('.dou-chat-plan__header').element.tagName).toBe('DIV')
  })

  it('forwards confirmations and artifacts', async () => {
    const confirm = { type: 'confirm' as const, id: 1, title: '删除？' }
    const artifact = { type: 'artifact' as const, id: 'a', title: '计划.md' }
    const wrapper = mount(DouChatMessage, { props: { parts: [confirm, artifact] } })
    await wrapper.findAll('.dou-chat-confirm__actions button').at(-1)!.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[confirm, 'approve']])
    await wrapper.get('.dou-chat-artifact__main').trigger('click')
    expect(wrapper.emitted('artifact')).toEqual([[artifact]])
  })

  it('hides the actions while busy', async () => {
    const wrapper = mount(DouChatMessage, {
      props: { parts: [{ type: 'text', text: '生成中', streaming: true }] },
    })
    expect(wrapper.find('.dou-chat-message__actions').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBe('true')
    await wrapper.setProps({ parts: [{ type: 'text', text: '好了' }] })
    expect(wrapper.find('.dou-chat-message__actions .dou-copy-button').exists()).toBe(true)
  })

  it('is busy while steps, a plan or a call look like they run', async () => {
    const wrapper = mount(DouChatMessage, {
      props: { parts: [{ type: 'steps', items: [], live: true }] },
    })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    for (const part of [
      { type: 'steps', items: [{ label: '读取网页', status: 'running' }] },
      { type: 'plan', items: [{ label: '查天气', status: 'running' }] },
      { type: 'tool', name: 'search_web', status: 'running' },
    ]) {
      await wrapper.setProps({ parts: [part] })
      expect(wrapper.attributes('aria-busy')).toBe('true')
      expect(wrapper.find('.dou-chat-message__actions').exists()).toBe(false)
    }
    await wrapper.setProps({
      parts: [
        { type: 'text', text: '停下了' },
        { type: 'tool', name: 'search_web', status: 'running', live: false },
        { type: 'steps', items: [{ label: '读取网页', status: 'running' }], live: false },
        { type: 'plan', items: [{ label: '查天气', status: 'running' }], live: false },
      ],
    })
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.find('.dou-chat-message__actions .dou-copy-button').exists()).toBe(true)
  })

  it('shows actions on hover for the person and always for the assistant by default', () => {
    const user = mount(DouChatMessage, { props: { sender: 'user', content: '周六去哪' } })
    const assistant = mount(DouChatMessage, { props: { content: '去滴水湖骑车。' } })
    const system = mount(DouChatMessage, { props: { sender: 'system', content: '已切换模型' } })
    expect(user.classes()).toContain('dou-chat-message--actions-hover')
    expect(assistant.classes()).toContain('dou-chat-message--actions-always')
    expect(system.classes()).toContain('dou-chat-message--actions-always')
  })

  it('takes when the actions show from `actionsVisible`', async () => {
    const wrapper = mount(DouChatMessage, {
      props: { content: '去滴水湖骑车。', actionsVisible: 'hover' },
    })
    expect(wrapper.classes()).toContain('dou-chat-message--actions-hover')
    expect(wrapper.classes()).not.toContain('dou-chat-message--actions-always')
    await wrapper.setProps({ sender: 'user', actionsVisible: 'always' })
    expect(wrapper.classes()).toContain('dou-chat-message--actions-always')
    expect(wrapper.classes()).not.toContain('dou-chat-message--actions-hover')
  })

  it('takes `actionsVisible` for every message from the ConfigProvider defaults', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { defaults: { DouChatMessage: { actionsVisible: 'hover' } } },
      slots: { default: () => h(DouChatMessage, { content: '去滴水湖骑车。' }) },
    })
    expect(wrapper.get('.dou-chat-message').classes()).toContain('dou-chat-message--actions-hover')
  })

  it('keeps the actions while only an artifact is still being made', () => {
    const wrapper = mount(DouChatMessage, {
      props: {
        parts: [
          { type: 'text', text: '图在生成' },
          { type: 'artifact', title: '路线图.png', kind: 'image', status: 'running' },
        ],
      },
    })
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.find('.dou-chat-message__actions .dou-copy-button').exists()).toBe(true)
  })

  it('shows the waiting dots while loading', () => {
    const wrapper = mount(DouChatMessage, { props: { loading: true } })
    expect(wrapper.get('.dou-chat-message__loading').attributes('aria-label')).toBe('正在回复')
  })

  it('switches versions', async () => {
    const wrapper = mount(DouChatMessage, { props: { content: '第三版', versions: 3 } })
    expect(wrapper.get('.dou-chat-message__version').text()).toBe('3 / 3')
    const [prev, next] = wrapper.findAll('.dou-chat-message__versions button')
    expect(next!.attributes('disabled')).toBeDefined()
    await prev!.trigger('click')
    expect(wrapper.emitted('update:version')).toEqual([[2]])
    expect(wrapper.get('.dou-chat-message__version').text()).toBe('2 / 3')
  })

  it('edits the person’s message in place', async () => {
    const wrapper = mount(DouChatMessage, {
      props: { sender: 'user', content: '周六去哪', editable: true },
      attachTo: document.body,
    })
    expect(wrapper.classes()).toContain('dou-chat-message--user')
    await wrapper.get('.dou-chat-message__actions button[aria-label="编辑"]').trigger('click')
    const editor = wrapper.get('textarea')
    expect((editor.element as HTMLTextAreaElement).value).toBe('周六去哪')
    await editor.setValue('周日去哪')
    await editor.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('edit')).toEqual([['周日去哪']])
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })

  it('puts the person’s files above the bubble', () => {
    const wrapper = mount(DouChatMessage, {
      props: {
        sender: 'user',
        parts: [
          { type: 'files', files: [{ uid: '1', name: 'a.pdf' }] },
          { type: 'text', text: '看看这个' },
        ],
      },
    })
    expect(wrapper.find('.dou-chat-message__files .dou-chat-attachments').exists()).toBe(true)
    expect(wrapper.get('.dou-chat-message__content').text()).toBe('看看这个')
  })

  it('joins the text parts for copying', () => {
    expect(
      messageText([{ type: 'text', text: 'a' }, { type: 'tool' }, { type: 'text', text: 'b' }]),
    ).toBe('a\n\nb')
  })

  it('marks a highlighted message', async () => {
    const wrapper = mount(DouChatMessage, { props: { content: '上海', highlighted: true } })
    expect(wrapper.classes()).toContain('is-highlighted')
    expect(wrapper.attributes('aria-current')).toBe('true')
    await wrapper.setProps({ highlighted: false })
    expect(wrapper.classes()).not.toContain('is-highlighted')
    expect(wrapper.attributes('aria-current')).toBeUndefined()
  })
})
