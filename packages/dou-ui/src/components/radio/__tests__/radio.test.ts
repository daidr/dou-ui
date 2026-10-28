import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { DouRadio, DouRadioGroup } from '../../../index'
import type { RadioValue } from '../../../index'

describe('DouRadio', () => {
  it('renders a native radio inside a label', () => {
    const wrapper = mount(DouRadio, { props: { value: 'a' }, slots: { default: '选项' } })
    expect(wrapper.element.tagName).toBe('LABEL')
    expect(wrapper.get('input').attributes('type')).toBe('radio')
    expect(wrapper.get('.dou-radio__label').text()).toBe('选项')
  })

  it('selects its value with a standalone v-model', async () => {
    const wrapper: VueWrapper = mount(DouRadio, {
      props: {
        value: 'a',
        modelValue: 'b',
        'onUpdate:modelValue': (value: RadioValue | undefined) => {
          void wrapper.setProps({ modelValue: value })
        },
      },
    })
    expect(wrapper.classes()).not.toContain('is-checked')
    await wrapper.get('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['a'])
    expect(wrapper.classes()).toContain('is-checked')
  })
})

const mountGroup = (groupProps: Record<string, unknown> = {}) => {
  const selected = ref<RadioValue | undefined>('b')
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouRadioGroup,
          {
            modelValue: selected.value,
            'onUpdate:modelValue': (value: RadioValue | undefined) => (selected.value = value),
            ...groupProps,
          },
          () => [
            h(DouRadio, { value: 'a' }, () => 'A'),
            h(DouRadio, { value: 'b' }, () => 'B'),
            h(DouRadio, { value: 'c' }, () => 'C'),
          ],
        ),
    ),
  )
  return { wrapper, selected }
}

describe('DouRadioGroup', () => {
  it('checks the selected option and shares a generated name', () => {
    const { wrapper } = mountGroup()
    const inputs = wrapper.findAll('input')
    expect(inputs.map((input) => input.element.checked)).toEqual([false, true, false])
    const names = new Set(inputs.map((input) => input.attributes('name')))
    expect(names.size).toBe(1)
    expect([...names][0]).toMatch(/^dou-radio-/)
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true)
  })

  it('updates the selection', async () => {
    const { wrapper, selected } = mountGroup()
    await wrapper.findAll('input')[2]!.setValue(true)
    expect(selected.value).toBe('c')
    expect(wrapper.findAll('.dou-radio')[2]!.classes()).toContain('is-checked')
  })

  it('passes disabled, size and name down', () => {
    const { wrapper } = mountGroup({ disabled: true, size: 'lg', name: 'plan' })
    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('disabled')).toBeDefined()
      expect(input.attributes('name')).toBe('plan')
    }
    expect(wrapper.findAll('.dou-radio--lg')).toHaveLength(3)
  })
})
