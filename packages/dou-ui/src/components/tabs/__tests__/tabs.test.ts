import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouTabPanel, DouTabs } from '../../../index'

const make = (props: Record<string, unknown> = {}) =>
  mount(
    defineComponent({
      setup() {
        const value = ref(props.modelValue as string | number | undefined)
        return () =>
          h(
            DouTabs,
            {
              ...props,
              modelValue: value.value,
              'onUpdate:modelValue': (v: string | number | undefined) => (value.value = v),
            },
            () => [
              h(DouTabPanel, { value: 'overview', label: '概览' }, () => '概览内容'),
              h(DouTabPanel, { value: 'logs', label: '日志' }, () => '日志内容'),
              h(DouTabPanel, { value: 'billing', label: '账单', disabled: true }, () => '账单内容'),
              h(DouTabPanel, { value: 'settings', label: '设置' }, () => '设置内容'),
            ],
          )
      },
    }),
    { attachTo: document.body },
  )

describe('DouTabs', () => {
  it('renders a tablist with the first enabled panel selected', async () => {
    const wrapper = make()
    await nextTick()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['概览', '日志', '账单', '设置'])
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(tabs[0]!.attributes('tabindex')).toBe('0')
    expect(tabs[1]!.attributes('tabindex')).toBe('-1')
    expect(tabs[2]!.attributes('aria-disabled')).toBe('true')

    const panel = wrapper.get(`#${tabs[0]!.attributes('aria-controls')}`)
    expect(panel.attributes('role')).toBe('tabpanel')
    expect(panel.attributes('aria-labelledby')).toBe(tabs[0]!.attributes('id'))
    expect(panel.text()).toBe('概览内容')
    wrapper.unmount()
  })

  it('selects a tab on click and renders panels lazily', async () => {
    const wrapper = make()
    await nextTick()
    const panels = wrapper.findAll('[role="tabpanel"]')
    expect(panels[1]!.text()).toBe('')
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')
    expect(panels[1]!.text()).toBe('日志内容')
    expect(panels[1]!.attributes('hidden')).toBeUndefined()
    expect(panels[0]!.attributes('hidden')).toBeDefined()
    // the first panel stays rendered once visited
    expect(panels[0]!.text()).toBe('概览内容')
    wrapper.unmount()
  })

  it('ignores clicks on a disabled tab', async () => {
    const wrapper = make()
    await nextTick()
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    expect(wrapper.findAll('[role="tab"]')[0]!.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('moves with arrow keys, skipping disabled tabs and wrapping around', async () => {
    const wrapper = make({ modelValue: 'logs' })
    await nextTick()
    const tabs = () => wrapper.findAll('[role="tab"]')
    await tabs()[1]!.trigger('keydown', { key: 'ArrowRight' })
    expect(tabs()[3]!.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs()[3]!.element)
    await tabs()[3]!.trigger('keydown', { key: 'ArrowRight' })
    expect(tabs()[0]!.attributes('aria-selected')).toBe('true')
    await tabs()[0]!.trigger('keydown', { key: 'End' })
    expect(tabs()[3]!.attributes('aria-selected')).toBe('true')
    await tabs()[3]!.trigger('keydown', { key: 'Home' })
    expect(tabs()[0]!.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('only moves focus with manual activation', async () => {
    const wrapper = make({ activation: 'manual' })
    await nextTick()
    const tabs = () => wrapper.findAll('[role="tab"]')
    await tabs()[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tabs()[1]!.element)
    expect(tabs()[0]!.attributes('aria-selected')).toBe('true')
    await tabs()[1]!.trigger('keydown', { key: 'Enter' })
    expect(tabs()[1]!.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('emits change and renders the label slot', async () => {
    const wrapper = mount(DouTabs, {
      slots: {
        default: () => [
          h(
            DouTabPanel,
            { value: 1 },
            { label: ({ selected }: { selected: boolean }) => `一${selected ? '*' : ''}` },
          ),
          h(DouTabPanel, { value: 2 }),
        ],
      },
    })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['一*', '2'])
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
    expect(wrapper.emitted('change')).toEqual([[2]])
  })
})
