import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouForm, DouFormItem, DouSelect } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const options = [
  { value: 'sh', label: '上海' },
  { value: 'sg', label: '新加坡' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'fra', label: 'Frankfurt' },
]

const optionEls = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

function withModel(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouSelect, {
    props: {
      options,
      modelValue: null,
      'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as never }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('DouSelect', () => {
  it('puts class and style on the field', () => {
    const wrapper = mount(DouSelect, {
      props: { options },
      attrs: { class: 'narrow', style: 'width: 120px' },
    })
    const field = wrapper.get('.dou-select')
    expect(field.classes()).toContain('narrow')
    expect(field.attributes('style')).toContain('width: 120px')
  })

  it('is a combobox that opens a listbox', async () => {
    const wrapper = withModel()
    const combobox = wrapper.get('[role="combobox"]')
    expect(combobox.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.dou-select__placeholder').text()).toBe('请选择')

    await combobox.trigger('mousedown')
    expect(combobox.attributes('aria-expanded')).toBe('true')
    const listbox = document.querySelector('[role="listbox"]')!
    expect(combobox.attributes('aria-controls')).toBe(listbox.id)
    expect(optionEls()).toHaveLength(4)
    expect(optionEls()[2]!.getAttribute('aria-disabled')).toBe('true')
    expect(combobox.attributes('aria-activedescendant')).toBe(optionEls()[0]!.id)
  })

  it('chooses with the pointer and closes', async () => {
    const wrapper = withModel()
    await wrapper.get('[role="combobox"]').trigger('mousedown')
    optionEls()[1]!.click()
    await nextTick()
    expect(wrapper.emitted('change')).toEqual([['sg']])
    expect(wrapper.props('modelValue')).toBe('sg')
    expect(wrapper.get('.dou-select__value').text()).toBe('新加坡')
    expect(wrapper.get('[role="combobox"]').attributes('aria-expanded')).toBe('false')
  })

  it('moves past disabled options with the keyboard', async () => {
    const wrapper = withModel({ modelValue: 'sg' })
    const combobox = wrapper.get('[role="combobox"]')
    key(combobox.element, 'ArrowDown')
    await nextTick()
    // opens on the chosen option
    expect(combobox.attributes('aria-activedescendant')).toBe(optionEls()[1]!.id)
    key(combobox.element, 'ArrowDown')
    await nextTick()
    expect(combobox.attributes('aria-activedescendant')).toBe(optionEls()[3]!.id)
    key(combobox.element, 'ArrowDown')
    await nextTick()
    expect(combobox.attributes('aria-activedescendant')).toBe(optionEls()[0]!.id)
    key(combobox.element, 'End')
    key(combobox.element, 'Enter')
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('fra')
  })

  it('jumps to an option by typing its first letters', async () => {
    const wrapper = withModel()
    const combobox = wrapper.get('[role="combobox"]')
    key(combobox.element, 'f')
    await nextTick()
    expect(combobox.attributes('aria-activedescendant')).toBe(optionEls()[3]!.id)
  })

  it('collects several values as removable tags', async () => {
    const wrapper = withModel({ multiple: true, modelValue: ['sh'] })
    await wrapper.get('[role="combobox"]').trigger('mousedown')
    expect(document.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe(
      'true',
    )
    optionEls()[1]!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toEqual(['sh', 'sg'])
    expect(wrapper.get('[role="combobox"]').attributes('aria-expanded')).toBe('true')
    optionEls()[0]!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toEqual(['sg'])
    await wrapper.get('.dou-tag__close').trigger('click')
    expect(wrapper.props('modelValue')).toEqual([])
  })

  it('filters by the typed text and shows an empty state', async () => {
    const wrapper = withModel({ filterable: true })
    const input = wrapper.get('input')
    expect(input.attributes('role')).toBe('combobox')
    await input.setValue('frank')
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual(['Frankfurt'])
    key(input.element, 'Enter')
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('fra')
    expect(input.attributes('placeholder')).toBe('Frankfurt')

    await input.setValue('zzz')
    expect(optionEls()).toHaveLength(0)
    expect(document.querySelector('.dou-select__empty')?.textContent?.trim()).toBe('无匹配项')
  })

  it('clears the value', async () => {
    const wrapper = withModel({ modelValue: 'sh', clearable: true })
    await wrapper.get('.dou-select__clear').trigger('click')
    expect(wrapper.props('modelValue')).toBeNull()
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('closes on a press outside and on Escape', async () => {
    const wrapper = withModel()
    const combobox = wrapper.get('[role="combobox"]')
    await combobox.trigger('mousedown')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
    await nextTick()
    expect(combobox.attributes('aria-expanded')).toBe('false')
    await combobox.trigger('mousedown')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(combobox.attributes('aria-expanded')).toBe('false')
  })

  it('does nothing while disabled', async () => {
    const wrapper = withModel({ disabled: true })
    const combobox = wrapper.get('[role="combobox"]')
    expect(combobox.attributes('aria-disabled')).toBe('true')
    expect(combobox.attributes('tabindex')).toBeUndefined()
    await combobox.trigger('mousedown')
    key(combobox.element, 'ArrowDown')
    await nextTick()
    expect(combobox.attributes('aria-expanded')).toBe('false')
  })

  it('is named by its form item', () => {
    const wrapper = mount(
      {
        render: () =>
          h(DouForm, null, () =>
            h(DouFormItem, { label: '区域' }, () => h(DouSelect, { options })),
          ),
      },
      { attachTo: document.body },
    )
    const label = wrapper.get('label, .dou-form-item__label')
    const combobox = wrapper.get('[role="combobox"]')
    expect(combobox.attributes('aria-labelledby')).toBe(label.attributes('id'))
    wrapper.unmount()
  })
})
