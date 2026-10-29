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
      { value: 'nb', label: '宁波' },
    ],
  },
  { value: 'sh', label: '上海', children: [{ value: 'pd', label: '浦东' }] },
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
      multiple: true,
      modelValue: [],
      'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as never }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

const openField = async (wrapper: ReturnType<typeof make>) => {
  await wrapper.get('.dou-cascader').trigger('mousedown')
  await nextTick()
}

describe('DouCascader multiple', () => {
  it('checks a branch as all of its last-level options', async () => {
    const wrapper = make()
    await openField(wrapper)
    const box = optionIn(lists()[0]!, '浙江').querySelector('input')!
    box.click()
    await flushPromises()
    expect(wrapper.props('modelValue')).toEqual([
      ['zj', 'hz', 'xh'],
      ['zj', 'hz', 'bj'],
      ['zj', 'nb'],
    ])
    const tags = wrapper.findAll('.dou-tag')
    expect(tags.map((tag) => tag.text())).toEqual([
      '浙江 / 杭州 / 西湖区',
      '浙江 / 杭州 / 滨江区',
      '浙江 / 宁波',
    ])
    // the panel stays open for more
    expect(wrapper.get('.dou-cascader').classes()).toContain('is-open')
  })

  it('shows a partly checked branch as indeterminate, and toggles leaves by click', async () => {
    const wrapper = make({ modelValue: [['zj', 'hz', 'xh']] })
    await openField(wrapper)
    optionIn(lists()[0]!, '浙江').click()
    await nextTick()
    optionIn(lists()[1]!, '杭州').click()
    await nextTick()
    const hz = optionIn(lists()[1]!, '杭州')
    expect(hz.querySelector('.dou-checkbox')!.classList).toContain('is-indeterminate')
    optionIn(lists()[2]!, '滨江区').click()
    await flushPromises()
    expect(wrapper.props('modelValue')).toEqual([
      ['zj', 'hz', 'xh'],
      ['zj', 'hz', 'bj'],
    ])
    expect(hz.getAttribute('aria-selected')).toBe('true')
    // removing a tag unchecks that path
    await wrapper.findAll('.dou-tag')[0]!.find('button').trigger('click')
    expect(wrapper.props('modelValue')).toEqual([['zj', 'hz', 'bj']])
  })

  it('checks every level on its own with checkStrictly', async () => {
    const wrapper = make({ checkStrictly: true, showLastOnly: true, maxTagCount: 1 })
    await openField(wrapper)
    optionIn(lists()[0]!, '浙江').querySelector('input')!.click()
    await flushPromises()
    optionIn(lists()[0]!, '上海').querySelector('input')!.click()
    await flushPromises()
    expect(wrapper.props('modelValue')).toEqual([['zj'], ['sh']])
    expect(wrapper.findAll('.dou-tag').map((tag) => tag.text())).toEqual(['浙江', '+1'])
  })
})
