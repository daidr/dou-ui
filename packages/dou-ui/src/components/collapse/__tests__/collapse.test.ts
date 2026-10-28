import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouCollapse, DouCollapseItem } from '../../../index'

const make = (props: Record<string, unknown> = {}) => {
  const value = ref<(string | number)[]>((props.modelValue as string[]) ?? [])
  const changes: [string | number, boolean][] = []
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            DouCollapse,
            {
              ...props,
              modelValue: value.value,
              'onUpdate:modelValue': (v: (string | number)[]) => (value.value = v),
              onChange: (v: string | number, open: boolean) => changes.push([v, open]),
            },
            () => [
              h(DouCollapseItem, { value: 'a', title: '基本信息' }, () => '内容 A'),
              h(DouCollapseItem, { value: 'b', title: '高级设置' }, () => '内容 B'),
              h(DouCollapseItem, { value: 'c', title: '危险区域', disabled: true }, () => '内容 C'),
            ],
          )
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, value, changes }
}

describe('DouCollapse', () => {
  it('links each header button to its region', () => {
    const { wrapper } = make()
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    const region = wrapper.get(`#${buttons[0]!.attributes('aria-controls')}`)
    expect(region.attributes('role')).toBe('region')
    expect(region.attributes('aria-labelledby')).toBe(buttons[0]!.attributes('id'))
    expect(buttons[0]!.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="heading"]').attributes('aria-level')).toBe('3')
    wrapper.unmount()
  })

  it('opens several items and renders the content lazily', async () => {
    const { wrapper, value, changes } = make()
    const regions = wrapper.findAll('[role="region"]')
    expect(regions[0]!.text()).toBe('')
    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(value.value).toEqual(['a', 'b'])
    expect(changes).toEqual([
      ['a', true],
      ['b', true],
    ])
    expect(wrapper.findAll('button')[0]!.attributes('aria-expanded')).toBe('true')
    expect(regions[0]!.text()).toBe('内容 A')
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(value.value).toEqual(['b'])
    wrapper.unmount()
  })

  it('keeps one item open in accordion mode', async () => {
    const { wrapper, value } = make({ accordion: true, modelValue: ['a'] })
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(value.value).toEqual(['b'])
    wrapper.unmount()
  })

  it('ignores disabled items', async () => {
    const { wrapper, value } = make()
    const button = wrapper.findAll('button')[2]!
    expect(button.attributes('aria-disabled')).toBe('true')
    await button.trigger('click')
    expect(value.value).toEqual([])
    wrapper.unmount()
  })

  it('sets the heading level', async () => {
    const { wrapper } = make({ headingLevel: 4 })
    await nextTick()
    expect(wrapper.find('[role="heading"]').attributes('aria-level')).toBe('4')
    wrapper.unmount()
  })
})
