import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouCheckTag, DouCheckTagGroup } from '../../../index'

describe('DouCheckTag', () => {
  it('toggles `checked` and reports it with aria-pressed', async () => {
    const wrapper = mount(DouCheckTag, {
      props: {
        checked: false,
        tone: 'primary' as const,
        'onUpdate:checked': (value: boolean) => wrapper.setProps({ checked: value }),
      },
      slots: { default: () => '前端' },
    })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('aria-pressed')).toBe('false')
    await wrapper.trigger('click')
    expect(wrapper.attributes('aria-pressed')).toBe('true')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['is-checked', 'dou-check-tag--primary']),
    )
    expect(wrapper.emitted('change')).toEqual([[true]])
  })

  it('does nothing while disabled', async () => {
    const wrapper = mount(DouCheckTag, { props: { disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:checked')).toBeUndefined()
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})

describe('DouCheckTagGroup', () => {
  const options = ['全部', '进行中', { value: '已完成', disabled: true }]

  it('selects one value, and clears it only when `clearable`', async () => {
    const wrapper = mount(DouCheckTagGroup, {
      props: {
        modelValue: '全部',
        options,
        'onUpdate:modelValue': (value: unknown) =>
          wrapper.setProps({ modelValue: value as string }),
      },
    })
    const tags = () => wrapper.findAll('.dou-check-tag')
    expect(wrapper.attributes('role')).toBe('group')
    expect(tags().map((tag) => tag.attributes('aria-pressed'))).toEqual(['true', 'false', 'false'])
    await tags()[1]!.trigger('click')
    expect(wrapper.props('modelValue')).toBe('进行中')
    await tags()[1]!.trigger('click')
    expect(wrapper.props('modelValue')).toBe('进行中')
    expect(tags()[2]!.attributes('disabled')).toBeDefined()

    await wrapper.setProps({ clearable: true })
    await tags()[1]!.trigger('click')
    expect(wrapper.props('modelValue')).toBeNull()
  })

  it('selects several values when `multiple`, with tags from the slot', async () => {
    const wrapper = mount(DouCheckTagGroup, {
      props: {
        modelValue: ['vue'],
        multiple: true,
        size: 'sm' as const,
        'onUpdate:modelValue': (value: unknown) =>
          wrapper.setProps({ modelValue: value as string[] }),
      },
      slots: {
        default: () => [
          h(DouCheckTag, { value: 'vue' }, () => 'Vue'),
          h(DouCheckTag, { value: 'ts' }, () => 'TypeScript'),
        ],
      },
    })
    const tags = () => wrapper.findAll('.dou-check-tag')
    expect(tags()[0]!.classes()).toContain('dou-check-tag--sm')
    await tags()[1]!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual(['vue', 'ts'])
    await tags()[0]!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual(['ts'])
    expect(wrapper.emitted('change')).toHaveLength(2)
  })

  it('leaves no empty icon when the leading slot renders nothing', async () => {
    const wrapper = mount({
      components: { DouCheckTag },
      props: { icon: { type: Boolean, default: false } },
      template: `<DouCheckTag><template #leading><svg v-if="icon" /></template>上海</DouCheckTag>`,
    })
    expect(wrapper.find('.dou-check-tag__icon').exists()).toBe(false)
    await wrapper.setProps({ icon: true })
    expect(wrapper.find('.dou-check-tag__icon svg').exists()).toBe(true)
  })
})
