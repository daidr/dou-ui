import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatInput } from '../../../index'

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

  it('turns into a stop button while loading', async () => {
    const wrapper = mount(DouChatInput, { props: { modelValue: '再来一段', loading: true } })
    const button = wrapper.get('.dou-chat-input__submit')
    expect(button.attributes('aria-label')).toBe('停止生成')
    await button.trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toBeUndefined()
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
