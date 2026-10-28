import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { DouCheckbox, DouCheckboxGroup } from '../../../index'
import type { CheckboxValue } from '../../../index'

describe('DouCheckbox', () => {
  it('renders a native checkbox inside a label', () => {
    const wrapper = mount(DouCheckbox, { slots: { default: '记住我' } })
    expect(wrapper.element.tagName).toBe('LABEL')
    expect(wrapper.get('input').attributes('type')).toBe('checkbox')
    expect(wrapper.get('.dou-checkbox__label').text()).toBe('记住我')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-checkbox', 'dou-checkbox--md']))
  })

  it('works with v-model', async () => {
    const wrapper = mount(DouCheckbox, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
      },
    })
    await wrapper.get('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true])
    expect(wrapper.classes()).toContain('is-checked')
    expect(wrapper.get('input').element.checked).toBe(true)
  })

  it('shows the indeterminate state on the native element', () => {
    const wrapper = mount(DouCheckbox, { props: { indeterminate: true, modelValue: true } })
    expect(wrapper.get('input').element.indeterminate).toBe(true)
    expect(wrapper.classes()).toContain('is-indeterminate')
    expect(wrapper.classes()).not.toContain('is-checked')
  })

  it('can be disabled', () => {
    const wrapper = mount(DouCheckbox, { props: { disabled: true } })
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('is-disabled')
  })
})

const mountGroup = (initial: CheckboxValue[], groupProps: Record<string, unknown> = {}) => {
  const selected = ref<CheckboxValue[]>(initial)
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouCheckboxGroup,
          {
            modelValue: selected.value,
            'onUpdate:modelValue': (value: CheckboxValue[]) => (selected.value = value),
            ...groupProps,
          },
          () => [
            h(DouCheckbox, { value: 'a' }, () => 'A'),
            h(DouCheckbox, { value: 'b' }, () => 'B'),
            h(DouCheckbox, { value: 'c', disabled: true }, () => 'C'),
          ],
        ),
    ),
  )
  return { wrapper, selected }
}

describe('DouCheckboxGroup', () => {
  it('checks the boxes whose values are selected', () => {
    const { wrapper } = mountGroup(['b'])
    const inputs = wrapper.findAll('input')
    expect(inputs.map((input) => input.element.checked)).toEqual([false, true, false])
    expect(wrapper.get('[role="group"]').classes()).toContain('dou-checkbox-group--horizontal')
  })

  it('adds and removes values as boxes toggle', async () => {
    const { wrapper, selected } = mountGroup(['b'])
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue(true)
    expect(selected.value).toEqual(['b', 'a'])
    await inputs[1]!.setValue(false)
    expect(selected.value).toEqual(['a'])
  })

  it('passes disabled, size and name down to every box', () => {
    const { wrapper } = mountGroup([], { disabled: true, size: 'sm', name: 'tags' })
    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('disabled')).toBeDefined()
      expect(input.attributes('name')).toBe('tags')
    }
    expect(wrapper.findAll('.dou-checkbox--sm')).toHaveLength(3)
  })
})
