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
    await new Promise((resolve) => requestAnimationFrame(resolve))
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

  it('keeps plain option labels free of child elements so block ellipsis applies', () => {
    const wrapper = setup({
      modelValue: 'list',
      options: ['侧栏顶部（推荐）', '顶栏常驻按钮', '单项目右侧 [更多]'],
    })
    for (const label of wrapper.findAll('.dou-segmented-control__label')) {
      expect(label.element.children).toHaveLength(0)
    }
  })

  it('keeps pure-text #option slots flat and wraps bare text beside icons in __text', () => {
    const textOnly = mount(DouSegmentedControl, {
      props: { options: ['侧栏顶部（推荐）', '顶栏常驻按钮'], modelValue: '侧栏顶部（推荐）' },
      slots: {
        option: ({ option }: { option: { label?: string; value: SegmentedControlValue } }) =>
          `${option.label ?? option.value}（默认）`,
      },
    })
    for (const label of textOnly.findAll('.dou-segmented-control__label')) {
      expect(label.element.children).toHaveLength(0)
      expect(label.find('.dou-segmented-control__text').exists()).toBe(false)
    }

    const withIcon = mount({
      components: { DouSegmentedControl },
      data: () => ({
        showBadge: false,
        options: [
          { value: 'top', label: '侧栏顶部（推荐）' },
          { value: 'bar', label: '顶栏常驻按钮' },
        ],
      }),
      template: `
        <DouSegmentedControl :options="options" model-value="top">
          <template #option="{ option }">
            <svg class="mock-icon" aria-hidden="true" />
            {{ option.label }}
            <span v-if="showBadge" class="mock-badge">新</span>
          </template>
        </DouSegmentedControl>
      `,
    })
    const firstLabel = withIcon.findAll('.dou-segmented-control__label')[0]!
    expect(firstLabel.find('svg.mock-icon').exists()).toBe(true)
    const texts = firstLabel.findAll('.dou-segmented-control__text')
    expect(texts).toHaveLength(1)
    expect(texts[0]!.text()).toBe('侧栏顶部（推荐）')

    const iconOnly = mount(DouSegmentedControl, {
      props: { options: ['list', 'board'], modelValue: 'list' },
      slots: {
        option: () => h('svg', { class: 'mock-icon' }),
      },
    })
    expect(iconOnly.find('.dou-segmented-control__text').exists()).toBe(false)
    expect(iconOnly.findAll('svg.mock-icon')).toHaveLength(2)
  })

  it('remeasures the indicator when block mode or options change', async () => {
    const wrapper = setup({ modelValue: 'board' })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await nextTick()
    const indicator = wrapper.get('.dou-segmented-control__indicator')
    expect(indicator.attributes('style')).toContain('translateX(')

    await wrapper.setProps({ block: true })
    await flushPromises()
    expect(indicator.attributes('style')).toContain('translateX(')

    await wrapper.setProps({
      options: [
        { value: 'list', label: '列表' },
        { value: 'board', label: '非常长的看板视图名称' },
        { value: 'timeline', label: '时间线视图' },
      ],
    })
    await flushPromises()
    expect(indicator.attributes('style')).not.toContain('display: none')
  })
})
