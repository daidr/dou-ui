import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouTabPanel, DouTabs } from '../../../index'

const make = (props: Record<string, unknown> = {}) => {
  const value = ref<string | number | undefined>('a')
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            DouTabs,
            {
              ...props,
              modelValue: value.value,
              'onUpdate:modelValue': (v: string | number | undefined) => (value.value = v),
            },
            () => [
              h(DouTabPanel, { value: 'a', label: '上海' }, () => 'A'),
              h(DouTabPanel, { value: 'b', label: '北京' }, () => 'B'),
              h(DouTabPanel, { value: 'c', label: '固定', closable: false }, () => 'C'),
            ],
          )
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, value, tabs: () => wrapper.findComponent(DouTabs) }
}

describe('DouTabs editing', () => {
  it('closes tabs from the close mark and the keyboard', async () => {
    const { wrapper, tabs } = make({ closable: true })
    await nextTick()
    const closes = wrapper.findAll('.dou-tabs__close')
    expect(closes).toHaveLength(2)
    await closes[1]!.trigger('click')
    expect(tabs().emitted('remove')).toEqual([['b']])
    // the click does not select the tab it closes
    expect(tabs().emitted('change')).toBeUndefined()
    const first = wrapper.findAll('[role="tab"]')[0]!
    expect(first.attributes('aria-keyshortcuts')).toBe('Delete')
    await first.trigger('keydown', { key: 'Delete' })
    expect(tabs().emitted('remove')?.at(-1)).toEqual(['a'])
    await wrapper.findAll('[role="tab"]')[2]!.trigger('keydown', { key: 'Delete' })
    expect(tabs().emitted('remove')).toHaveLength(2)
    wrapper.unmount()
  })

  it('offers an add button', async () => {
    const { wrapper, tabs } = make({ addable: true })
    await wrapper.get('.dou-tabs__add').trigger('click')
    expect(tabs().emitted('add')).toHaveLength(1)
    wrapper.unmount()
  })

  it('asks before leaving a tab', async () => {
    let allow = false
    const { wrapper, value } = make({ beforeLeave: async () => allow })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await new Promise((done) => setTimeout(done))
    expect(value.value).toBe('a')
    allow = true
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await new Promise((done) => setTimeout(done))
    expect(value.value).toBe('b')
    wrapper.unmount()
  })

  it('stands vertically and steps with up and down', async () => {
    const { wrapper } = make({ placement: 'start' })
    await nextTick()
    expect(wrapper.classes()).toContain('is-vertical')
    expect(wrapper.get('[role="tablist"]').attributes('aria-orientation')).toBe('vertical')
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(tabs[1]!.element)
    wrapper.unmount()
  })
})
