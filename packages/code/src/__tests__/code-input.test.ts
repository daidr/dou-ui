import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouForm, DouFormItem } from 'dou-ui'
import { type CodeEditorExpose, DouCodeInput, defineCodeExtension } from '../index'

function setup(props: Record<string, unknown> = {}, initial = 'a + b') {
  const code = ref(initial)
  const input = ref<CodeEditorExpose>()
  const entered: string[] = []
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeInput, {
          ref: input,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          onEnter: () => entered.push(code.value),
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
  textarea.focus()
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      cancelable: true,
      ...init,
    })
    textarea.dispatchEvent(event)
    await nextTick()
    return event
  }
  return { wrapper, code, input, textarea, key, entered }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouCodeInput', () => {
  it('is one line: Enter hands over, Tab leaves, and there is no gutter', async () => {
    const { wrapper, code, key, entered, input } = setup()
    input.value!.select(5)
    const enter = await key('Enter')
    expect(enter.defaultPrevented).toBe(true)
    expect(code.value).toBe('a + b')
    expect(entered).toEqual(['a + b'])
    // Tab is left to the browser, to move on to the next control.
    const tab = await key('Tab')
    expect(tab.defaultPrevented).toBe(false)
    expect(code.value).toBe('a + b')
    expect(wrapper.find('.dou-code-editor__gutter').exists()).toBe(false)
    expect(wrapper.find('.dou-code-input--md').exists()).toBe(true)
  })

  it('turns pasted line breaks into spaces', async () => {
    const { wrapper, code, input } = setup({}, '')
    input.value!.select(0)
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => 'values.a\n  && values.b' },
    })
    wrapper.find('textarea').element.dispatchEvent(event)
    await nextTick()
    expect(code.value).toBe('values.a && values.b')
  })

  it('takes several lines with multiline, Mod+Enter handing over', async () => {
    const { code, key, entered, input } = setup({ multiline: true }, 'a')
    input.value!.select(1)
    await key('Enter')
    expect(code.value).toBe('a\n')
    expect(entered).toEqual([])
    await key('Enter', { ctrlKey: true })
    expect(entered).toEqual(['a\n'])
  })

  it('takes the form item’s id, description and size', async () => {
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouForm, { size: 'sm' }, () =>
            h(DouFormItem, { label: '公式', help: '按 Enter 提交' }, () =>
              h(DouCodeInput, { modelValue: '1 + 1' }),
            ),
          ),
      ),
      { attachTo: document.body },
    )
    await nextTick()
    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('id')).toBeTruthy()
    expect(wrapper.find(`label[for="${textarea.attributes('id')}"]`).exists()).toBe(true)
    expect(textarea.attributes('aria-describedby')).toBeTruthy()
    expect(wrapper.find('.dou-code-input--sm').exists()).toBe(true)
  })

  it('is read-only inside a read-only form', async () => {
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouForm, { readonly: true }, () =>
            h(DouFormItem, { label: '公式' }, () => h(DouCodeInput, { modelValue: '1 + 1' })),
          ),
      ),
    )
    await nextTick()
    expect(wrapper.find('textarea').element.readOnly).toBe(true)
    wrapper.unmount()
  })

  it('shows the completion list above the page', async () => {
    const words = defineCodeExtension({
      name: 'words',
      completion: ({ word }) => ({ from: word.from, options: [{ label: 'values' }] }),
    })
    const { wrapper, textarea } = setup({ extensions: [words] }, '')
    textarea.value = 'v'
    textarea.setSelectionRange(1, 1)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await nextTick()
    // Teleported out of the input's frame.
    expect(wrapper.find('.dou-code-editor__completions').exists()).toBe(false)
    expect(document.body.querySelector('.dou-code-editor__floating.is-outside')).not.toBeNull()
  })

  it('keeps the completion list inside with teleport false', async () => {
    const words = defineCodeExtension({
      name: 'words',
      completion: ({ word }) => ({ from: word.from, options: [{ label: 'values' }] }),
    })
    const { wrapper, textarea } = setup({ extensions: [words], teleport: false }, '')
    textarea.value = 'v'
    textarea.setSelectionRange(1, 1)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await nextTick()
    expect(wrapper.find('.dou-code-editor__completions').exists()).toBe(true)
    expect(document.body.querySelector('.dou-code-editor__floating.is-outside')).toBeNull()
  })

  it('sets the least and the most lines with autosize', () => {
    const { wrapper } = setup({ multiline: true, autosize: { minRows: 3, maxRows: 2 } })
    const style = (wrapper.find('.dou-code-input').element as HTMLElement).style
    expect(style.getPropertyValue('--dou-code-input-min-rows')).toBe('3')
    // The most is never below the least.
    expect(style.getPropertyValue('--dou-code-input-max-rows')).toBe('3')
  })
})
