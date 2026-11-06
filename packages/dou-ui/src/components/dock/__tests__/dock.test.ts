import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouDock } from '../../../index'
import type { DockNode } from '../layout'

const panels = [
  { value: 'thread', label: '需求讨论' },
  { value: 'plan', label: '发布计划' },
  { value: 'api', label: '接口文档', closable: false },
]

const make = (props: Record<string, unknown> = {}) => {
  const layout = ref<DockNode>({
    type: 'split',
    direction: 'horizontal',
    size: 60,
    start: { type: 'group', id: 'a', tabs: ['thread', 'plan'] },
    end: { type: 'group', id: 'b', tabs: ['api'] },
  })
  const events: unknown[][] = []
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          DouDock,
          {
            panels,
            ...props,
            modelValue: layout.value,
            'onUpdate:modelValue': (value: DockNode) => (layout.value = value),
            onMove: (e: unknown) => events.push(['move', e]),
            onRemove: (...args: unknown[]) => events.push(['remove', ...args]),
          },
          { default: ({ value }: { value: string }) => `${value} 的内容` },
        ),
    }),
    { attachTo: document.body },
  )
  return { wrapper, layout, events }
}

describe('DouDock', () => {
  it('renders a splitter and a tabs per group, with the labels of the panels', async () => {
    const { wrapper } = make()
    await nextTick()
    expect(wrapper.findAll('.dou-splitter')).toHaveLength(1)
    const groups = wrapper.findAll('[data-dock-group]')
    expect(groups.map((group) => group.attributes('data-dock-group'))).toEqual(['a', 'b'])
    expect(groups[0]!.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      '需求讨论',
      '发布计划',
    ])
    expect(groups[0]!.find('[role="tabpanel"]:not([hidden])').text()).toBe('thread 的内容')
    wrapper.unmount()
  })

  it('writes the selected tab of a group into the layout', async () => {
    const { wrapper, layout } = make()
    await nextTick()
    await wrapper.findAll('[data-dock-group="a"] [role="tab"]')[1]!.trigger('click')
    expect(layout.value.type === 'split' && layout.value.start).toMatchObject({ active: 'plan' })
    wrapper.unmount()
  })

  it('moves a tab within a group with the keyboard', async () => {
    const { wrapper, layout, events } = make()
    await nextTick()
    await wrapper
      .find('[data-dock-group="a"] [role="tab"]')
      .trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(layout.value.type === 'split' && layout.value.start).toMatchObject({
      tabs: ['plan', 'thread'],
    })
    expect(events).toEqual([['move', { value: 'thread', from: 'a', to: 'a', index: 1 }]])
    wrapper.unmount()
  })

  it('only emits remove, with the group', async () => {
    const { wrapper, layout, events } = make({ closable: true })
    await nextTick()
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[0]!.trigger('keydown', { key: 'Delete' })
    // a panel's own `closable` wins
    await tabs[2]!.trigger('keydown', { key: 'Delete' })
    expect(events).toEqual([['remove', 'thread', 'a']])
    expect(layout.value.type).toBe('split')
    wrapper.unmount()
  })

  it('shows the empty slot when no tab is left', async () => {
    const wrapper = mount(DouDock, {
      props: { modelValue: { type: 'group', id: 'a', tabs: [] } },
      slots: { empty: () => '没有打开的标签' },
    })
    expect(wrapper.find('.dou-dock__empty').text()).toBe('没有打开的标签')
    wrapper.unmount()
  })
})
