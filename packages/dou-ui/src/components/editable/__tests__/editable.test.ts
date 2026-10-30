import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouEditable } from '../../../index'

const flush = () => new Promise((resolve) => setTimeout(resolve))

describe('DouEditable', () => {
  it('shows the value, or the placeholder when empty', async () => {
    const wrapper = mount(DouEditable, { props: { modelValue: '季度复盘', placeholder: '未命名' } })
    const view = wrapper.get('.dou-editable__view')
    expect(view.text()).toBe('季度复盘')
    expect(view.attributes('role')).toBe('button')
    expect(view.attributes('tabindex')).toBe('0')
    expect(view.attributes('aria-description')).toBe('按 Enter 编辑')
    await wrapper.setProps({ modelValue: '' })
    expect(view.text()).toBe('未命名')
    expect(view.classes()).toContain('is-empty')
  })

  it('opens on click, saves on Enter and puts focus back', async () => {
    const wrapper = mount(DouEditable, {
      props: { modelValue: '季度复盘' },
      attachTo: document.body,
    })
    await wrapper.get('.dou-editable__view').trigger('click')
    const input = wrapper.get('input')
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.emitted('update:editing')).toEqual([[true]])
    await input.setValue('第三季度复盘')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await input.trigger('keydown', { key: 'Enter' })
    await flush()
    expect(wrapper.emitted('update:modelValue')).toEqual([['第三季度复盘']])
    expect(wrapper.emitted('submit')).toEqual([['第三季度复盘']])
    expect(wrapper.find('input').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.dou-editable__view').element)
    wrapper.unmount()
  })

  it('drops the edit on Escape without bubbling', async () => {
    const outer = { escape: 0 }
    const wrapper = mount(DouEditable, { props: { modelValue: '季度复盘', editing: true } })
    wrapper.element.addEventListener('keydown', () => outer.escape++)
    await nextTick()
    const input = wrapper.get('input')
    await input.setValue('别的')
    await input.trigger('keydown', { key: 'Escape' })
    await flush()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(outer.escape).toBe(0)
  })

  it('does not confirm while an input method is composing', async () => {
    const wrapper = mount(DouEditable, { props: { modelValue: '', editing: true } })
    await nextTick()
    await wrapper.get('input').trigger('keydown', { key: 'Enter', isComposing: true })
    await flush()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('saves or drops on blur as configured', async () => {
    const wrapper = mount(DouEditable, { props: { modelValue: 'a', editing: true } })
    await nextTick()
    await wrapper.get('input').setValue('b')
    await wrapper.get('input').trigger('blur')
    await flush()
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])

    const dropping = mount(DouEditable, {
      props: { modelValue: 'a', editing: true, blurAction: 'cancel' },
    })
    await nextTick()
    await dropping.get('input').setValue('b')
    await dropping.get('input').trigger('blur')
    await flush()
    expect(dropping.emitted('update:modelValue')).toBeUndefined()
    expect(dropping.emitted('cancel')).toHaveLength(1)
  })

  it('stays open with a message when validate refuses', async () => {
    const wrapper = mount(DouEditable, {
      props: {
        modelValue: '季度复盘',
        editing: true,
        validate: async (value: string) => (value.trim() ? true : '名称不能为空'),
      },
    })
    await nextTick()
    const input = wrapper.get('input')
    await input.setValue('  ')
    await input.trigger('keydown', { key: 'Enter' })
    await flush()
    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toBe('名称不能为空')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(
      wrapper.get('[role="alert"]').attributes('id'),
    )
    await input.setValue('复盘')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await input.trigger('keydown', { key: 'Enter' })
    await flush()
    expect(wrapper.emitted('update:modelValue')).toEqual([['复盘']])
  })

  it('adds lines with Enter and confirms with Mod+Enter when multiline', async () => {
    const wrapper = mount(DouEditable, {
      props: { modelValue: '', editing: true, multiline: true },
    })
    await nextTick()
    const area = wrapper.get('textarea')
    await area.setValue('第一行')
    await area.trigger('keydown', { key: 'Enter' })
    await flush()
    expect(wrapper.emitted('submit')).toBeUndefined()
    await area.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flush()
    expect(wrapper.emitted('submit')).toEqual([['第一行']])
  })

  it('opens with Enter or F2, on double click when asked, and never when disabled', async () => {
    const wrapper = mount(DouEditable, { props: { modelValue: 'a', trigger: 'dblclick' } })
    await wrapper.get('.dou-editable__view').trigger('click')
    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.get('.dou-editable__view').trigger('dblclick')
    expect(wrapper.find('input').exists()).toBe(true)

    const keyboard = mount(DouEditable, { props: { modelValue: 'a' } })
    await keyboard.get('.dou-editable__view').trigger('keydown', { key: 'F2' })
    expect(keyboard.find('input').exists()).toBe(true)

    const disabled = mount(DouEditable, { props: { modelValue: 'a', disabled: true } })
    const view = disabled.get('.dou-editable__view')
    expect(view.attributes('tabindex')).toBeUndefined()
    await view.trigger('click')
    await view.trigger('keydown', { key: 'Enter' })
    expect(disabled.find('input').exists()).toBe(false)
  })
})
