import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DouCascader,
  DouCheckbox,
  DouColorPicker,
  DouDatePicker,
  DouForm,
  DouFormItem,
  DouInput,
  DouInputNumber,
  DouInputOtp,
  DouListbox,
  DouRadio,
  DouRadioGroup,
  DouRate,
  DouSegmentedControl,
  DouSelect,
  DouSlider,
  DouSwitch,
  DouTextarea,
  DouTimePicker,
  DouTreeSelect,
} from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const options = [
  { label: '上海', value: 'sh' },
  { label: '杭州', value: 'hz' },
]

/** Mount controls inside a read-only form and collect what they emit. */
function inForm(children: () => unknown[], readonly = true) {
  return mount(
    () =>
      h(DouForm, { readonly }, () => children().map((child) => h(DouFormItem, null, () => child))),
    { attachTo: document.body },
  )
}

describe('Form readonly', () => {
  it('reaches every kind of control', () => {
    const wrapper = inForm(() => [
      h(DouInput, { modelValue: 'a' }),
      h(DouTextarea, { modelValue: 'a' }),
      h(DouInputNumber, { modelValue: 1 }),
      h(DouInputOtp, { modelValue: '12' }),
      h(DouSelect, { modelValue: 'sh', options }),
      h(DouCascader, { modelValue: ['sh'], options }),
      h(DouTreeSelect, {
        modelValue: 'sh',
        data: options.map(({ label, value }) => ({ label, key: value })),
      }),
      h(DouDatePicker, { modelValue: '2026-10-31' }),
      h(DouTimePicker, { modelValue: '09:00' }),
      h(DouColorPicker, { modelValue: '#000000' }),
      h(DouCheckbox, { modelValue: true }),
      h(DouRadioGroup, { modelValue: 'a' }, () => [h(DouRadio, { value: 'a' })]),
      h(DouSwitch, { modelValue: true }),
      h(DouSlider, { modelValue: 10 }),
      h(DouSegmentedControl, { modelValue: 'sh', options }),
      h(DouListbox, { modelValue: 'sh', options }),
      h(DouRate, { modelValue: 3 }),
    ])
    for (const name of [
      'input',
      'textarea',
      'input-number',
      'input-otp',
      'select',
      'cascader',
      'tree-select',
      'date-picker',
      'time-picker',
      'color-picker',
      'checkbox',
      'radio',
      'switch',
      'slider',
      'segmented-control',
      'listbox',
      'rate',
    ]) {
      const root = wrapper.find(`.dou-${name}`)
      const marked = root.classes().includes('is-readonly') || root.find('.is-readonly').exists()
      expect({ name, marked }).toEqual({ name, marked: true })
    }
    // text boxes get the native attribute, so the value can still be selected
    for (const selector of [
      '.dou-input input',
      'textarea',
      '.dou-input-number input',
      '.dou-date-picker input',
      '.dou-time-picker input',
    ])
      expect({ selector, readonly: wrapper.get(selector).attributes('readonly') }).toEqual({
        selector,
        readonly: '',
      })
    // and nothing is disabled
    // (the number steppers are buttons that cannot act, so they are disabled)
    expect(wrapper.findAll('[disabled]:not(.dou-input-number__step)')).toHaveLength(0)
  })

  it('a form that is not read-only leaves controls alone', () => {
    const wrapper = inForm(() => [h(DouInput, { modelValue: 'a' }), h(DouSwitch)], false)
    expect(wrapper.find('.is-readonly').exists()).toBe(false)
  })

  it('does not open pickers', async () => {
    const wrapper = inForm(() => [h(DouSelect, { modelValue: 'sh', options, clearable: true })])
    const field = wrapper.get('.dou-select')
    expect(field.attributes('aria-readonly')).toBe('true')
    await field.trigger('mousedown')
    await field.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(field.attributes('aria-expanded')).toBe('false')
    // no clear button either
    expect(wrapper.find('.dou-select__clear').exists()).toBe(false)
  })

  it('cancels the click on a box or an option', async () => {
    const wrapper = inForm(() => [
      h(DouCheckbox, { modelValue: false }),
      h(DouRadioGroup, { modelValue: 'a' }, () => [
        h(DouRadio, { value: 'a' }),
        h(DouRadio, { value: 'b' }),
      ]),
    ])
    const box = wrapper.get('.dou-checkbox input').element as HTMLInputElement
    box.click()
    expect(box.checked).toBe(false)
    const other = wrapper.findAll('.dou-radio input')[1]!.element as HTMLInputElement
    other.click()
    expect(other.checked).toBe(false)
  })

  it('lets a control opt out only by its own prop being set on a plain form', () => {
    const wrapper = mount(() => h(DouInput, { modelValue: 'a', readonly: true }))
    expect(wrapper.get('input').attributes('readonly')).toBeDefined()
  })
})
