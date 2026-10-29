import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouMention } from '../../../index'
import { findMention } from '../caret'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('findMention', () => {
  it('finds a prefix at a word start before the caret', () => {
    expect(findMention('你好 @da', 6, ['@'])).toEqual({ prefix: '@', start: 3, query: 'da' })
    expect(findMention('@', 1, ['@'])).toEqual({ prefix: '@', start: 0, query: '' })
    expect(findMention('看 #设计', 5, ['@', '#'])).toEqual({ prefix: '#', start: 2, query: '设计' })
  })

  it('ignores a prefix inside a word or before a space', () => {
    expect(findMention('mail@daidr', 10, ['@'])).toBeNull()
    expect(findMention('@daidr 你好', 9, ['@'])).toBeNull()
  })
})

const options = [
  { value: 'daidr', label: 'Dairyn', description: '维护者' },
  { value: 'designer', label: '设计师' },
  { value: 'bot', label: '机器人', disabled: true },
]

async function type(wrapper: ReturnType<typeof make>, text: string) {
  const field = wrapper.get('textarea').element as HTMLTextAreaElement
  field.focus()
  field.value = text
  field.setSelectionRange(text.length, text.length)
  field.dispatchEvent(new Event('input'))
  await nextTick()
  await nextTick()
  await nextTick()
}

function make(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouMention, {
    props: {
      modelValue: '',
      options,
      'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

const listed = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent?.trim())

describe('DouMention', () => {
  it('opens matching suggestions after the prefix', async () => {
    const wrapper = make()
    await type(wrapper, '请 @d')
    const field = wrapper.get('textarea')
    expect(field.attributes('aria-expanded')).toBe('true')
    expect(listed()).toEqual(['Dairyn维护者', '设计师'])
    expect(wrapper.emitted('search')?.at(-1)).toEqual(['d', '@'])
    expect(field.attributes('aria-activedescendant')).toBe(
      document.querySelector('[role="option"]')!.id,
    )
    wrapper.unmount()
  })

  it('inserts the chosen value with the keyboard', async () => {
    const wrapper = make()
    await type(wrapper, '请 @d')
    const field = wrapper.get('textarea')
    await field.trigger('keydown', { key: 'ArrowDown' })
    await field.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toBe('请 @designer ')
    expect(wrapper.emitted('select')?.[0]).toEqual([options[1], '@'])
    expect(field.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('closes on Escape and leaves filtering off when asked', async () => {
    const wrapper = make({ filter: false })
    await type(wrapper, '@zzz')
    expect(listed()).toHaveLength(3)
    await wrapper.get('textarea').trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('textarea').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })
})
