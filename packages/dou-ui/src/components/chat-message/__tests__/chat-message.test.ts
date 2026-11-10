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

  it('shows actions on hover for every message by default', () => {
    const user = mount(DouChatMessage, { props: { sender: 'user', content: '周六去哪' } })
    const assistant = mount(DouChatMessage, { props: { content: '去滴水湖骑车。' } })
    const system = mount(DouChatMessage, { props: { sender: 'system', content: '已切换模型' } })
    expect(user.classes()).toContain('dou-chat-message--actions-hover')
    expect(assistant.classes()).toContain('dou-chat-message--actions-hover')
    expect(system.classes()).toContain('dou-chat-message--actions-hover')
  })

  it('toggles the actions with a tap, but not with a click or a tap on a button', async () => {
    const wrapper = mount(DouChatMessage, {
      props: { content: '去滴水湖骑车。' },
      attachTo: document.body,
    })
    const content = wrapper.get('.dou-chat-message__content')
    await content.trigger('pointerup', { pointerType: 'mouse' })
    expect(wrapper.classes()).not.toContain('is-touched')
    await content.trigger('pointerup', { pointerType: 'touch' })
    expect(wrapper.classes()).toContain('is-touched')
    await wrapper.get('.dou-chat-message__actions button').trigger('pointerup', {
      pointerType: 'touch',
    })
    expect(wrapper.classes()).toContain('is-touched')
    // a tap anywhere else hides them
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('is-touched')
    wrapper.unmount()
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

  it('puts the trailing slot after the last text part, whatever `actionsVisible` is', () => {
    const mark = { trailing: () => h('button', { class: 'mark' }, '已编辑') }
    for (const markdown of [false, true]) {
      const wrapper = mount(DouChatMessage, {
        props: {
          parts: [
            { type: 'text', text: '先查天气。' },
            { type: 'tool', name: 'get_weather' },
            { type: 'text', text: '周六适合去滴水湖骑车。' },
          ],
          markdown,
          actionsVisible: 'hover',
        },
        slots: mark,
      })
      const texts = wrapper.findAll('.dou-chat-message__text')
      expect(wrapper.findAll('.mark')).toHaveLength(1)
      expect(texts[1]!.find('.mark').exists()).toBe(true)
      // not on the reasoning, nor among the actions
      expect(wrapper.find('.dou-chat-message__actions .mark').exists()).toBe(false)
      wrapper.unmount()
    }
    // no text: a line after the parts
    const tools = mount(DouChatMessage, {
      props: { parts: [{ type: 'tool', name: 'get_weather' }] },
      slots: mark,
    })
    const content = tools.get('.dou-chat-message__content').element
    expect(content.lastElementChild!.className).toBe('dou-chat-message__trailing')
    // not before the loading dots: it waits until loading ends
    const waiting = mount(DouChatMessage, { props: { parts: [], loading: true }, slots: mark })
    expect(waiting.find('.mark').exists()).toBe(false)
  })

  it('keeps the trailing slot off the reasoning in Markdown', () => {
    const wrapper = mount(DouChatMessage, {
      props: {
        parts: [
          { type: 'reasoning', text: '想一想' },
          { type: 'text', text: '好的。' },
        ],
        markdown: true,
      },
      slots: { trailing: () => h('i', { class: 'mark' }, '已编辑') },
    })
    expect(wrapper.findAll('.mark')).toHaveLength(1)
    expect(wrapper.find('.dou-chat-reasoning .mark').exists()).toBe(false)
  })
  describe('reactions', () => {
    const reactions = [
      { emoji: '👍', count: 2, reacted: true, label: '戴兜和小王' },
      { emoji: '🎉', count: 1 },
      { emoji: '👀', count: 0 },
    ]

    it('shows reactions with a count under the message and reports presses', async () => {
      const wrapper = mount(DouChatMessage, { props: { content: '周六去滴水湖。', reactions } })
      const chips = wrapper.findAll('.dou-chat-message__reaction')
      // a reaction at 0 is left out
      expect(chips.map((chip) => chip.text())).toEqual(['👍2', '🎉1'])
      expect(chips[0]!.attributes('aria-pressed')).toBe('true')
      expect(chips[1]!.attributes('aria-pressed')).toBe('false')
      expect(chips[1]!.attributes('aria-label')).toBe('🎉 1 人')
      await chips[0]!.trigger('click')
      expect(wrapper.emitted('react')).toEqual([['👍']])
      // the row follows the parts, before the actions
      const order = [...wrapper.element.children].map((el) => el.className.split(' ')[0])
      expect(order).toEqual([
        'dou-chat-message__content',
        'dou-chat-message__reactions',
        'dou-chat-message__toolbar',
      ])
    })

    it('offers no add button without a picker', () => {
      const wrapper = mount(DouChatMessage, { props: { content: '好', reactions } })
      expect(wrapper.find('button[aria-label="添加回应"]').exists()).toBe(false)
    })

    it('puts the add button among the actions until the first reaction', async () => {
      const wrapper = mount(DouChatMessage, {
        props: { content: '好' },
        slots: { 'reaction-picker': () => h('i') },
      })
      expect(wrapper.find('.dou-chat-message__reactions').exists()).toBe(false)
      expect(
        wrapper.find('.dou-chat-message__actions button[aria-label="添加回应"]').exists(),
      ).toBe(true)
      await wrapper.setProps({ reactions })
      expect(
        wrapper.find('.dou-chat-message__actions button[aria-label="添加回应"]').exists(),
      ).toBe(false)
      expect(
        wrapper.find('.dou-chat-message__reactions button[aria-label="添加回应"]').exists(),
      ).toBe(true)
    })

    it('reacts from the picker and closes it', async () => {
      const wrapper = mount(DouChatMessage, {
        props: { content: '好' },
        attachTo: document.body,
        slots: {
          'reaction-picker': ({ react }: { react: (emoji: string) => void }) =>
            h('button', { class: 'pick', onClick: () => react('🚀') }, '🚀'),
        },
      })
      await wrapper.get('button[aria-label="添加回应"]').trigger('click')
      await new Promise((resolve) => setTimeout(resolve, 0))
      const pick = document.querySelector<HTMLButtonElement>('.pick')!
      expect(wrapper.classes()).toContain('is-reacting')
      pick.click()
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('react')).toEqual([['🚀']])
      expect(wrapper.classes()).not.toContain('is-reacting')
      wrapper.unmount()
    })

    it('renders the emoji with the `reaction` slot', () => {
      const wrapper = mount(DouChatMessage, {
        props: { content: '好', reactions: [{ emoji: 'party', count: 3 }] },
        slots: {
          reaction: ({ reaction }: { reaction: { emoji: string } }) =>
            h('img', { alt: reaction.emoji }),
        },
      })
      expect(wrapper.get('.dou-chat-message__reaction img').attributes('alt')).toBe('party')
    })
  })
})
