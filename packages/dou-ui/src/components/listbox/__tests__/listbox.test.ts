import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouForm, DouFormItem, DouListbox } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const options = [
  { value: 'sh', label: '上海', description: '华东 2' },
  { value: 'sg', label: '新加坡' },
  { value: 'iad', label: '弗吉尼亚', disabled: true },
  { value: 'fra', label: 'Frankfurt' },
]

const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

function withModel(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouListbox, {
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

describe('DouListbox', () => {
  it('is a listbox of options', () => {
    const wrapper = withModel({ modelValue: 'sg', ariaLabel: '区域' })
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('aria-label')).toBe('区域')
    expect(list.attributes('tabindex')).toBe('0')
    const items = wrapper.findAll('[role="option"]')
    expect(items).toHaveLength(4)
    expect(items[0]!.text()).toContain('华东 2')
    expect(items[1]!.attributes('aria-selected')).toBe('true')
    expect(items[2]!.attributes('aria-disabled')).toBe('true')
  })

  it('chooses with the pointer and skips disabled options', async () => {
    const wrapper = withModel()
    const items = wrapper.findAll('[role="option"]')
    await items[2]!.trigger('click')
    expect(wrapper.props('modelValue')).toBe(null)
    await items[0]!.trigger('click')
    expect(wrapper.props('modelValue')).toBe('sh')
    expect(wrapper.emitted('change')).toEqual([['sh']])
  })

  it('moves with the keyboard past disabled options and chooses', async () => {
    const wrapper = withModel({ modelValue: 'sg' })
    const list = wrapper.get('[role="listbox"]')
    await list.trigger('focus')
    expect(list.attributes('aria-activedescendant')).toBe(
      wrapper.findAll('[role="option"]')[1]!.attributes('id'),
    )
    key(list.element, 'ArrowDown')
    await nextTick()
    const active = () => wrapper.get('.dou-listbox__option.is-active').text()
    expect(active()).toBe('Frankfurt')
    key(list.element, 'Home')
    await nextTick()
    expect(active()).toContain('上海')
    key(list.element, 'f')
    await nextTick()
    expect(active()).toBe('Frankfurt')
    key(list.element, 'Enter')
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('fra')
  })

  it('toggles options in a multiple listbox', async () => {
    const wrapper = withModel({ multiple: true, modelValue: ['sh'] })
    expect(wrapper.get('[role="listbox"]').attributes('aria-multiselectable')).toBe('true')
    const items = wrapper.findAll('[role="option"]')
    await items[1]!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual(['sh', 'sg'])
    const list = wrapper.get('[role="listbox"]')
    await list.trigger('focus')
    key(list.element, ' ')
    await nextTick()
    expect(wrapper.props('modelValue')).toEqual(['sg'])
  })

  it('filters from a search box that keeps focus', async () => {
    const wrapper = withModel({ filterable: true })
    const input = wrapper.get('input')
    expect(wrapper.get('[role="listbox"]').attributes('tabindex')).toBe('-1')
    await input.setValue('frank')
    expect(wrapper.findAll('[role="option"]').map((item) => item.text())).toEqual(['Frankfurt'])
    expect(input.attributes('aria-activedescendant')).toBe(
      wrapper.get('[role="option"]').attributes('id'),
    )
    key(input.element, 'Enter')
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('fra')
    await input.setValue('不存在')
    expect(wrapper.get('.dou-listbox__empty').text()).toBe('无匹配项')
  })

  it('lists groups under their labels', () => {
    const wrapper = withModel({
      options: [
        { label: '亚洲', options: ['上海', '新加坡'] },
        { label: '欧洲', options: ['Frankfurt'], disabled: true },
      ],
    })
    const groups = wrapper.findAll('[role="group"]')
    expect(groups).toHaveLength(2)
    expect(
      document.getElementById(groups[0]!.attributes('aria-labelledby')!)!.textContent,
    ).toContain('亚洲')
    expect(groups[1]!.get('[role="option"]').attributes('aria-disabled')).toBe('true')
  })

  it('is named by its form item and takes the form size', () => {
    const wrapper = mount(DouForm, {
      props: { model: {}, size: 'sm' },
      slots: {
        default: () => h(DouFormItem, { label: '区域' }, () => h(DouListbox, { options })),
      },
      attachTo: document.body,
    })
    const list = wrapper.get('[role="listbox"]')
    const label = document.getElementById(list.attributes('aria-labelledby')!)
    expect(wrapper.get('.dou-listbox').classes()).toContain('dou-listbox--sm')
    expect(label?.textContent).toContain('区域')
  })
})
