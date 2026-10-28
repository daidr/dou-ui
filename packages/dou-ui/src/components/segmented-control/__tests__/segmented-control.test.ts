import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouForm, DouFormItem, DouSegmentedControl } from '../../../index'
import type { SegmentedControlProps, SegmentedControlValue } from '../../../index'

const options: SegmentedControlProps['options'] = [
  { value: 'list', label: '列表' },
  { value: 'board', label: '看板' },
  { value: 'calendar', label: '日历', disabled: true },
]

function setup(props: Partial<SegmentedControlProps> = {}) {
  const wrapper = mount(DouSegmentedControl, {
    props: {
      options,
      ...props,
      'onUpdate:modelValue': (value: SegmentedControlValue | undefined) =>
        wrapper.setProps({ modelValue: value }),
    },
  })
  return wrapper
}

describe('DouSegmentedControl', () => {
  it('renders a radio group with one native radio per option', () => {
    const wrapper = setup({ modelValue: 'list' })
    expect(wrapper.attributes('role')).toBe('radiogroup')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-segmented-control', 'dou-segmented-control--md']),
    )
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(3)
    const names = new Set(radios.map((radio) => radio.attributes('name')))
    expect(names.size).toBe(1)
    expect((radios[0]!.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '列表',
      '看板',
      '日历',
    ])
  })

  it('accepts plain values as options', () => {
    const wrapper = setup({ options: ['日', '周', 12] })
    expect(wrapper.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '日',
      '周',
      '12',
    ])
  })

  it('selects an option and reports the change', async () => {
    const wrapper = setup({ modelValue: 'list' })
    await wrapper.findAll('input')[1]!.setValue(true)
    expect(wrapper.props('modelValue')).toBe('board')
    expect(wrapper.emitted('change')).toEqual([['board']])
    expect(wrapper.findAll('.dou-segmented-control__item')[1]!.classes()).toContain('is-checked')
  })

  it('disables single options or the whole control', () => {
    const wrapper = setup()
    expect(wrapper.findAll('input')[2]!.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.dou-segmented-control__item')[2]!.classes()).toContain('is-disabled')
    const all = setup({ disabled: true })
    expect(all.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(
      true,
    )
    expect(all.attributes('aria-disabled')).toBe('true')
  })

  it('places the indicator on the selected option', async () => {
    const wrapper = setup({ modelValue: 'board' })
    await nextTick()
    const indicator = wrapper.get('.dou-segmented-control__indicator')
    // happy-dom does no layout, so the block sits at 0 with no width,
    // but it is shown once there is a selection.
    expect(indicator.attributes('style')).not.toContain('display: none')
    await wrapper.setProps({ modelValue: 'missing' })
    await flushPromises()
    expect(indicator.attributes('style')).toContain('display: none')
  })

  it('stretches with block', () => {
    expect(setup({ block: true }).classes()).toContain('is-block')
  })

  it('takes its label and size from a form item', async () => {
    const wrapper = mount(DouForm, {
      props: { size: 'sm' },
      slots: {
        default: () =>
          h(DouFormItem, { label: '视图' }, () => h(DouSegmentedControl, { options: ['a', 'b'] })),
      },
    })
    await nextTick()
    const label = wrapper.get('label.dou-form-item__label')
    const group = wrapper.get('[role="radiogroup"]')
    expect(label.attributes('for')).toBeUndefined()
    expect(group.attributes('aria-labelledby')).toBe(label.attributes('id'))
    expect(group.classes()).toContain('dou-segmented-control--sm')
  })
})
