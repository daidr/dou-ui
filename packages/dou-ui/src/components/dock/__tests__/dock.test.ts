import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouDock } from '../../../index'
import { splitDockTab } from '../layout'
import type { DockExpose } from '../dock'
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
    expect(events).toEqual([
      ['move', { value: 'thread', from: { group: 'a', index: 0 }, to: { group: 'a', index: 1 } }],
    ])
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

  it('builds on the layout the parent keeps when it turns a change down', async () => {
    const layout = ref<DockNode>({ type: 'group', id: 'a', tabs: ['x', 'y', 'z'] })
    let refuse = true
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouDock, {
            modelValue: layout.value,
            panels: [{ value: 'x' }, { value: 'y' }, { value: 'z' }],
            'onUpdate:modelValue': (value: DockNode) => {
              if (!refuse) layout.value = value
            },
          }),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    await wrapper.find('[role="tab"]').trigger('keydown', { key: 'ArrowRight', altKey: true })
    await nextTick()
    refuse = false
    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')
    // the refused move does not come back with the next change
    expect(layout.value).toMatchObject({ tabs: ['x', 'y', 'z'], active: 'z' })
    wrapper.unmount()
  })

  it('keeps a group where it is when the layout around it changes', async () => {
    const { wrapper, layout } = make()
    await nextTick()
    await nextTick()
    const panel = wrapper.find('[data-dock-group="b"] [role="tabpanel"]').element
    // split a tab of the first group off to the right of the second
    layout.value = splitDockTab(layout.value, 'plan', 'b', 'right', 'c')
    await nextTick()
    await nextTick()
    expect(panel.isConnected).toBe(true)
    expect(wrapper.find('[data-dock-group="b"] [role="tabpanel"]').element).toBe(panel)
    expect(wrapper.find('[data-dock-group="c"]').exists()).toBe(true)
    // the split has a smallest size on both sides
    const bars = wrapper.findAll('.dou-splitter__bar')
    expect(bars).toHaveLength(2)
    wrapper.unmount()
  })

  it('turns dragging off', async () => {
    const { wrapper, events } = make({ draggable: false })
    await nextTick()
    await wrapper.find('[role="tab"]').trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(events).toEqual([])
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

  it('takes `min` apart by direction', async () => {
    const wrapper = mount(DouDock, {
      props: {
        panels,
        min: { width: '220px' },
        modelValue: {
          type: 'split',
          direction: 'horizontal',
          start: { type: 'group', id: 'a', tabs: ['thread'] },
          end: {
            type: 'split',
            direction: 'vertical',
            start: { type: 'group', id: 'b', tabs: ['plan'] },
            end: { type: 'group', id: 'c', tabs: ['api'] },
          },
        } satisfies DockNode,
      },
    })
    await nextTick()
    const [across, down] = wrapper.findAllComponents({ name: 'DouSplitter' })
    expect(across!.props()).toMatchObject({ min: '220px', minEnd: '220px' })
    // left out: the default
    expect(down!.props()).toMatchObject({ min: '120px', minEnd: '120px' })
    wrapper.unmount()
  })

  it('tells whether a group has room to split, and warns of a percent too big to split', async () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 441, height: 300 } as DOMRect)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouDock, {
      props: {
        panels,
        min: { width: '220px', height: 60 },
        modelValue: { type: 'group', id: 'a', tabs: ['thread', 'plan'] } satisfies DockNode,
      },
      attachTo: document.body,
    })
    await nextTick()
    const dock: DockExpose = wrapper.vm
    // 441 holds 220 + 1 + 220; 60% twice does not fit
    expect(dock.canSplit('a', 'right')).toBe(true)
    expect(dock.canSplit('a', 'bottom')).toBe(false)
    expect(dock.canSplit('missing', 'right')).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Write '60px' for px"))
    wrapper.unmount()
    rect.mockRestore()
    warn.mockRestore()
  })
})
