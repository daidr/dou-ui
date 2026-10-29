import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouSelect } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const optionEls = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]

function withModel(props: Record<string, unknown>, slots: Record<string, unknown> = {}) {
  const wrapper = mount(DouSelect, {
    props: {
      modelValue: null,
      'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as never }),
      ...props,
    } as never,
    slots: slots as never,
    attachTo: document.body,
  })
  return wrapper
}

const open = async (wrapper: ReturnType<typeof withModel>) => {
  await wrapper.get('.dou-select').trigger('mousedown')
  await nextTick()
}

const cities = [
  { value: 'sh', label: '上海' },
  { value: 'sg', label: '新加坡' },
  { value: 'fra', label: '法兰克福' },
  { value: 'iad', label: '弗吉尼亚' },
]

describe('DouSelect tags', () => {
  it('folds tags past maxTagCount into +N', () => {
    const wrapper = withModel({
      options: cities,
      multiple: true,
      maxTagCount: 2,
      modelValue: ['sh', 'sg', 'fra', 'iad'],
    })
    const tags = wrapper.findAll('.dou-select__tag')
    expect(tags.map((tag) => tag.text())).toEqual(['上海', '新加坡', '+2'])
    expect(tags[2]!.attributes('title')).toBe('法兰克福、弗吉尼亚')
  })

  it('stops at multipleLimit and reports removed tags', async () => {
    const wrapper = withModel({
      options: cities,
      multiple: true,
      multipleLimit: 2,
      modelValue: ['sh', 'sg'],
    })
    await open(wrapper)
    const options = optionEls()
    expect(options[2]!.getAttribute('aria-disabled')).toBe('true')
    options[2]!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toEqual(['sh', 'sg'])
    // a chosen option can still be removed
    expect(options[0]!.getAttribute('aria-disabled')).toBeNull()
    await wrapper.findAll('.dou-select__tag')[1]!.find('button').trigger('click')
    expect(wrapper.emitted('removeTag')).toEqual([['sg']])
    expect(wrapper.props('modelValue')).toEqual(['sh'])
  })

  it('matches object values by valueKey', async () => {
    const people = [
      { value: { id: 1, name: '小林' }, label: '小林' },
      { value: { id: 2, name: '阿周' }, label: '阿周' },
    ]
    const wrapper = withModel({
      options: people,
      valueKey: 'id',
      modelValue: { id: 2, name: '阿周' },
    })
    expect(wrapper.get('.dou-select__value').text()).toBe('阿周')
    await open(wrapper)
    expect(optionEls()[1]!.getAttribute('aria-selected')).toBe('true')
    optionEls()[0]!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toEqual({ id: 1, name: '小林' })
  })

  it('renders header, footer, tag and label slots, and reports opening', async () => {
    const wrapper = withModel(
      { options: cities, multiple: true, modelValue: ['sh'] },
      {
        header: () => h('span', { class: 'head' }, '全选'),
        footer: () => h('span', { class: 'foot' }, '添加'),
        tag: ({ option }: { option: { label: string } }) =>
          h('b', { class: 'my-tag' }, option.label),
      },
    )
    expect(wrapper.get('.my-tag').text()).toBe('上海')
    await open(wrapper)
    expect(document.querySelector('.dou-select__header .head')).not.toBeNull()
    expect(document.querySelector('.dou-select__footer .foot')).not.toBeNull()
    expect(wrapper.emitted('visibleChange')).toEqual([[true]])

    const single = withModel(
      { options: cities, modelValue: 'sg' },
      { label: ({ option }: { option: { label: string } }) => `→ ${option.label}` },
    )
    expect(single.get('.dou-select__value').text()).toBe('→ 新加坡')
  })
})
