import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatInput } from '../../../index'
import { findToken } from '../chat-input'

describe('DouChatInput', () => {
  it('sends on Enter but not on Shift+Enter or while composing', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: '你好' } })
    const textarea = wrapper.get('textarea')
    expect(textarea.attributes('placeholder')).toBe('发送消息')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    await textarea.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toEqual([['你好']])
  })

  it('sends on Ctrl / ⌘ + Enter with `mod-enter`', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: 'hi', submitOn: 'mod-enter' } })
    const textarea = wrapper.get('textarea')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await textarea.trigger('keydown', { key: 'Enter', metaKey: true })
    expect(wrapper.emitted('submit')).toEqual([['hi']])
  })

  it('does not send blank text unless `canSubmit` says so', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: '  ' } })
    const button = wrapper.get('.dou-chat-input__submit')
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.setProps({ canSubmit: true })
    await wrapper.get('.dou-chat-input__submit').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([['  ']])
  })

  it('stops while loading, but sends again once something is typed', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: '', loading: true } })
    const button = wrapper.get('.dou-chat-input__submit')
    expect(button.attributes('aria-label')).toBe('停止生成')
    await button.trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)

    await wrapper.setProps({ modelValue: '顺便查下天气' })
    expect(wrapper.get('.dou-chat-input__submit').attributes('aria-label')).toBe('发送')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toEqual([['顺便查下天气']])
  })

  it('offers commands after a leading slash', async () => {
    const wrapper = mount(DouChatInput, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': (value: unknown): void => {
          void wrapper.setProps({ modelValue: value as string })
        },
        commands: [
          { value: 'summarize', label: '总结' },
          { value: 'translate', label: '翻译' },
        ],
      },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('/tr')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(3, 3)
    await textarea.trigger('keyup')
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toContain('/翻译')
    expect(textarea.attributes('aria-expanded')).toBe('true')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('command')).toEqual([[{ value: 'translate', label: '翻译' }]])
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.props('modelValue')).toBe('')
    wrapper.unmount()
  })

  it('inserts mentions after an at sign', async () => {
    const wrapper = mount(DouChatInput, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': (value: unknown): void => {
          void wrapper.setProps({ modelValue: value as string })
        },
        mentions: [{ value: '周报.md' }, { value: '戴兜' }],
      },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('看下 @周')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(5, 5)
    await textarea.trigger('keyup')
    await wrapper.get('[role="option"]').trigger('click')
    expect(wrapper.props('modelValue')).toBe('看下 @周报.md ')
    expect(wrapper.emitted('mention')).toEqual([[{ value: '周报.md' }]])
    wrapper.unmount()
  })

  it('closes the menu on Escape', async () => {
    const wrapper = mount(DouChatInput, {
      props: { modelValue: '@', mentions: [{ value: '戴兜' }] },
      attachTo: document.body,
    })
    const textarea = wrapper.get('textarea')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(1, 1)
    await textarea.trigger('keyup')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    await textarea.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('finds the token at the caret', () => {
    expect(findToken('/sum', 4)).toEqual({ trigger: '/', query: 'sum', start: 0, end: 4 })
    expect(findToken('a /sum', 6)).toBeNull()
    expect(findToken('问 @戴', 4)).toEqual({ trigger: '@', query: '戴', start: 2, end: 4 })
    expect(findToken('mail@x', 6)).toBeNull()
  })

  it('updates the model and renders the slots', async () => {
    const wrapper = mount(DouChatInput, {
      props: { modelValue: '' },
      slots: { header: () => '附件', actions: () => '工具' },
    })
    await wrapper.get('textarea').setValue('写一首诗')
    expect(wrapper.emitted('update:modelValue')).toEqual([['写一首诗']])
    expect(wrapper.get('.dou-chat-input__header').text()).toBe('附件')
    expect(wrapper.get('.dou-chat-input__actions').text()).toBe('工具')
  })

  it('hands dropped files over', async () => {
    const wrapper = mount(DouChatInput)
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await wrapper.trigger('drop', { dataTransfer: { files: [file], types: ['Files'] } })
    expect(wrapper.emitted('attach')).toEqual([[[file]]])
  })
})
