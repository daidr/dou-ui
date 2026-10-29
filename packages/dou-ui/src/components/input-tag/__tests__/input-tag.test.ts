import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouInputTag } from '../../../index'

function make(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouInputTag, {
    props: {
      modelValue: [] as string[],
      'onUpdate:modelValue': (value: string[]) => wrapper.setProps({ modelValue: value }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

const tags = (wrapper: ReturnType<typeof make>) =>
  wrapper.findAll('.dou-tag__label').map((tag) => tag.text())

describe('DouInputTag', () => {
  it('turns typed text into a tag on Enter', async () => {
    const wrapper = make({ placeholder: '输入关键词' })
    const input = wrapper.get('input')
    expect(input.attributes('placeholder')).toBe('输入关键词')
    await input.setValue('  设计 ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toEqual(['设计'])
    expect(wrapper.emitted('add')?.[0]).toEqual(['设计'])
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(input.attributes('placeholder')).toBeUndefined()
    wrapper.unmount()
  })

  it('ends a tag at a typed separator and splits pasted text', async () => {
    const wrapper = make()
    const input = wrapper.get('input')
    await input.setValue('上海,')
    expect(wrapper.props('modelValue')).toEqual(['上海'])

    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => '北京，深圳\n杭州' },
    })
    input.element.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.props('modelValue')).toEqual(['上海', '北京', '深圳', '杭州'])
    wrapper.unmount()
  })

  it('refuses duplicates, invalid tags and tags over the limit', async () => {
    const wrapper = make({
      modelValue: ['a@b.cn'],
      max: 2,
      validate: (tag: string) => tag.includes('@'),
    })
    const input = wrapper.get('input')
    await input.setValue('a@b.cn')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toEqual(['a@b.cn'])
    expect((input.element as HTMLInputElement).value).toBe('a@b.cn')

    await input.setValue('不是邮箱')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toEqual(['a@b.cn'])

    await input.setValue('c@d.cn')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toEqual(['a@b.cn', 'c@d.cn'])
    // Full: the text box steps aside.
    expect((input.element as HTMLElement).style.display).toBe('none')
    wrapper.unmount()
  })

  it('removes the last tag with a second Backspace', async () => {
    const wrapper = make({ modelValue: ['一', '二'] })
    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.findAll('.dou-input-tag__tag')[1]!.classes()).toContain('is-pending')
    expect(wrapper.props('modelValue')).toEqual(['一', '二'])
    await input.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.props('modelValue')).toEqual(['一'])
    expect(wrapper.emitted('remove')?.[0]).toEqual(['二', 1])
    wrapper.unmount()
  })

  it('removes a tag from its button, named after the tag', async () => {
    const wrapper = make({ modelValue: ['一', '二'] })
    const close = wrapper.findAll('.dou-tag__close')[0]!
    expect(close.attributes('aria-label')).toBe('移除 一')
    await close.trigger('click')
    expect(tags(wrapper)).toEqual(['二'])
    wrapper.unmount()
  })

  it('adds what was typed on blur, and clears', async () => {
    const wrapper = make({ clearable: true })
    const input = wrapper.get('input')
    await input.setValue('草稿')
    await input.trigger('blur')
    expect(wrapper.props('modelValue')).toEqual(['草稿'])
    await wrapper.get('.dou-input-tag__clear').trigger('click')
    expect(wrapper.props('modelValue')).toEqual([])
    expect(wrapper.emitted('clear')).toHaveLength(1)
    wrapper.unmount()
  })

  it('is fixed when disabled', () => {
    const wrapper = make({ modelValue: ['一'], disabled: true })
    expect(wrapper.classes()).toContain('is-disabled')
    expect(wrapper.find('.dou-tag__close').exists()).toBe(false)
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
