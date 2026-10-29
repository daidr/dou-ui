import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouCascader } from '../../../index'
import type { CascaderOption } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const options: CascaderOption[] = [
  {
    value: 'zj',
    label: '浙江',
    children: [
      {
        value: 'hz',
        label: '杭州',
        children: [
          { value: 'xh', label: '西湖区' },
          { value: 'bj', label: '滨江区' },
        ],
      },
      { value: 'nb', label: '宁波', disabled: true },
    ],
  },
  { value: 'gd', label: '广东', children: [{ value: 'sz', label: '深圳' }] },
]

const lists = () => [...document.querySelectorAll('[role="listbox"]')]
const optionIn = (list: Element, label: string) =>
  [...list.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (el) => el.textContent?.trim() === label,
  )!

const make = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(DouCascader, {
    props: {
      options,
      modelValue: null,
      'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as string[] }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

const field = (wrapper: ReturnType<typeof make>) => wrapper.get('.dou-cascader')

describe('DouCascader', () => {
  it('shows the chosen path in the field', () => {
    const wrapper = make({ modelValue: ['zj', 'hz', 'xh'] })
    expect(wrapper.text()).toContain('浙江 / 杭州 / 西湖区')
    expect(field(wrapper).attributes('role')).toBe('combobox')
    wrapper.unmount()
  })

  it('opens column after column and picks a leaf', async () => {
    const wrapper = make()
    await field(wrapper).trigger('mousedown')
    expect(lists()).toHaveLength(1)
    optionIn(lists()[0]!, '浙江').click()
    await flushPromises()
    expect(lists()).toHaveLength(2)
    expect(optionIn(lists()[0]!, '浙江').getAttribute('aria-expanded')).toBe('true')
    expect(optionIn(lists()[1]!, '宁波').getAttribute('aria-disabled')).toBe('true')
    optionIn(lists()[1]!, '杭州').click()
    await flushPromises()
    optionIn(lists()[2]!, '滨江区').click()
    await flushPromises()
    expect(wrapper.props('modelValue')).toEqual(['zj', 'hz', 'bj'])
    expect(wrapper.emitted('change')![0]![1]).toHaveLength(3)
    expect(field(wrapper).attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('walks the columns with the keyboard', async () => {
    const wrapper = make()
    await field(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(field(wrapper).attributes('aria-activedescendant')).toBe(
      optionIn(lists()[0]!, '浙江').id,
    )
    await field(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(field(wrapper).attributes('aria-activedescendant')).toBe(
      optionIn(lists()[0]!, '广东').id,
    )
    await field(wrapper).trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(field(wrapper).attributes('aria-activedescendant')).toBe(
      optionIn(lists()[1]!, '深圳').id,
    )
    await field(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.props('modelValue')).toEqual(['gd', 'sz'])
    wrapper.unmount()
  })

  it('loads children lazily', async () => {
    const wrapper = make({
      options: [{ value: 'root', label: '根' }],
      load: async (option: CascaderOption) => [
        { value: `${option.value}-a`, label: '子项', leaf: true },
      ],
    })
    await field(wrapper).trigger('mousedown')
    optionIn(lists()[0]!, '根').click()
    await flushPromises()
    await nextTick()
    expect(lists()).toHaveLength(2)
    optionIn(lists()[1]!, '子项').click()
    await flushPromises()
    expect(wrapper.props('modelValue')).toEqual(['root', 'root-a'])
    wrapper.unmount()
  })

  it('searches full paths', async () => {
    const wrapper = make({ filterable: true })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('滨江')
    await nextTick()
    const found = [...document.querySelectorAll('[role="option"]')].map((el) =>
      el.textContent?.trim(),
    )
    expect(found).toEqual(['浙江 / 杭州 / 滨江区'])
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toEqual(['zj', 'hz', 'bj'])
    wrapper.unmount()
  })

  it('lets any level be chosen with changeOnSelect', async () => {
    const wrapper = make({ changeOnSelect: true })
    await field(wrapper).trigger('mousedown')
    optionIn(lists()[0]!, '浙江').click()
    await flushPromises()
    expect(wrapper.props('modelValue')).toEqual(['zj'])
    wrapper.unmount()
  })

  it('keeps the search highlight when the parent passes equal options again', async () => {
    const wrapper = make({ filterable: true })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('区')
    await nextTick()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.setProps({ options: structuredClone(options) })
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toEqual(['zj', 'hz', 'bj'])
    wrapper.unmount()
  })
})
