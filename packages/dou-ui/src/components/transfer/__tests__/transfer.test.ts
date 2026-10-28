import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouTransfer } from '../../../index'

const data = [
  { key: 1, label: '甲' },
  { key: 2, label: '乙' },
  { key: 3, label: '丙', disabled: true },
  { key: 4, label: '丁' },
]

const make = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(DouTransfer, {
    props: {
      data,
      modelValue: [4],
      height: 200,
      'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as number[] }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

const lists = (wrapper: ReturnType<typeof make>) => wrapper.findAll('section')
const labels = (section: ReturnType<ReturnType<typeof make>['findAll']>[number]) =>
  section.findAll('.dou-transfer__label').map((el) => el.text())

describe('DouTransfer', () => {
  it('splits the items between two named lists', () => {
    const wrapper = make()
    const [source, target] = lists(wrapper)
    expect(source!.attributes('aria-label')).toBe('待选')
    expect(labels(source!)).toEqual(['甲', '乙', '丙'])
    expect(labels(target!)).toEqual(['丁'])
    expect(source!.find('.dou-transfer__count').text()).toBe('0 / 3')
    wrapper.unmount()
  })

  it('moves checked items across and back', async () => {
    const wrapper = make()
    const [toTarget, toSource] = wrapper.findAll('.dou-transfer__actions button')
    expect(toTarget!.attributes('disabled')).toBeDefined()
    await lists(wrapper)[0]!.findAll('input[type="checkbox"]')[1]!.setValue(true)
    expect(lists(wrapper)[0]!.find('.dou-transfer__count').text()).toBe('1 / 3')
    await toTarget!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual([4, 1])
    expect(wrapper.emitted('change')![0]).toEqual([[4, 1], 'target', [1]])
    expect(labels(lists(wrapper)[1]!)).toEqual(['丁', '甲'])

    await lists(wrapper)[1]!.findAll('input[type="checkbox"]')[0]!.setValue(true)
    await toSource!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual([])
    wrapper.unmount()
  })

  it('selects every movable visible item at once', async () => {
    const wrapper = make({ modelValue: [] })
    const all = lists(wrapper)[0]!.find('input[type="checkbox"]')
    await all.setValue(true)
    expect(lists(wrapper)[0]!.find('.dou-transfer__count').text()).toBe('3 / 4')
    await wrapper.findAll('.dou-transfer__actions button')[0]!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual([1, 2, 4])
    wrapper.unmount()
  })

  it('filters each list', async () => {
    const wrapper = make({ filterable: true, modelValue: [] })
    await lists(wrapper)[0]!.find('.dou-transfer__search input').setValue('乙')
    await nextTick()
    expect(labels(lists(wrapper)[0]!)).toEqual(['乙'])
    await lists(wrapper)[0]!.find('.dou-transfer__search input').setValue('无')
    expect(lists(wrapper)[0]!.text()).toContain('无匹配结果')
    wrapper.unmount()
  })
})
