import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouDock } from '../../../index'
import { splitDockTab } from '../layout'
import type { DockContext } from '../context'
import type { DockGroup, DockNode } from '../layout'

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

  it('puts the `extra` slot at the end of each tab row, with its group', async () => {
    const shown = ref(false)
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouDock,
            {
              panels,
              modelValue: {
                type: 'split',
                direction: 'horizontal',
                start: { type: 'group', id: 'a', tabs: ['thread', 'plan'], active: 'plan' },
                end: { type: 'group', id: 'b', tabs: ['api'] },
              } satisfies DockNode,
            },
            shown.value
              ? {
                  extra: ({ group, active }: { group: DockGroup; active?: string }) =>
                    h('button', `${group.id}:${active}`),
                }
              : {},
          ),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    expect(wrapper.find('.dou-tabs__extra').exists()).toBe(false)
    // a slot that comes later shows up; `active` falls back to the first tab
    shown.value = true
    await nextTick()
    const groups = wrapper.findAll('[data-dock-group]')
    expect(groups.map((group) => group.find('.dou-tabs__extra').text())).toEqual([
      'a:plan',
      'b:api',
    ])
    wrapper.unmount()
  })

  it('keeps the group last used in `v-model:active-group`', async () => {
    const layout = ref<DockNode>({
      type: 'split',
      direction: 'horizontal',
      start: { type: 'group', id: 'a', tabs: ['thread', 'plan'] },
      end: { type: 'group', id: 'b', tabs: ['api'] },
    })
    const active = ref<string | undefined>()
    const updates: (string | undefined)[] = []
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouDock, {
            panels,
            modelValue: layout.value,
            'onUpdate:modelValue': (value: DockNode) => (layout.value = value),
            activeGroup: active.value,
            'onUpdate:activeGroup': (value: string | undefined) => {
              updates.push(value)
              active.value = value
            },
          }),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    // not on mount
    expect(updates).toEqual([])
    const groups = () => wrapper.findAll('[data-dock-group]')
    await groups()[1]!.find('[role="tab"]').trigger('pointerdown')
    await groups()[1]!.find('[role="tab"]').trigger('focusin')
    expect(updates).toEqual(['b'])

    // a tab moved into a group makes it the one last used
    const [first] = wrapper.findAllComponents({ name: 'DouTabs' })
    first!.vm.$emit('move', {
      value: 'plan',
      from: { name: 'a', index: 1 },
      to: { name: 'a', index: 0 },
    })
    await nextTick()
    expect(active.value).toBe('a')

    // split off to a new group: that one
    const group = wrapper.findAllComponents({ name: 'DouDockGroup' })[0]!
    const { dock } = (group.vm.$ as unknown as { setupState: { dock: DockContext } }).setupState
    const drag = { value: 'thread', label: '需求讨论', group: dock.group, name: 'a', index: 1 }
    dock.drop({ ...drag, source: {} }, group.props('group'), 'right')
    await nextTick()
    expect(active.value).toBe('group-1')

    // dragged empty and gone: cleared
    first!.vm.$emit('move', {
      value: 'plan',
      from: { name: 'a', index: 0 },
      to: { name: 'b', index: 1 },
    })
    await nextTick()
    expect(active.value).toBe('b')
    active.value = 'a'
    await nextTick()
    expect(active.value).toBeUndefined()
    // from one id not in the layout straight to another
    active.value = 'x'
    await nextTick()
    expect(active.value).toBeUndefined()
    wrapper.unmount()
  })

  it('clears an active group given at first that is not in the layout', async () => {
    const wrapper = mount(DouDock, {
      props: { modelValue: { type: 'group', id: 'a', tabs: ['thread'] }, activeGroup: 'gone' },
    })
    expect(wrapper.emitted('update:activeGroup')).toEqual([[undefined]])
    wrapper.unmount()
  })

  it('emits the group last used only when it changes, also without binding it', async () => {
    const updates: unknown[] = []
    const wrapper = mount(DouDock, {
      props: {
        panels,
        modelValue: {
          type: 'split',
          direction: 'horizontal',
          start: { type: 'group', id: 'a', tabs: ['thread', 'plan'] },
          end: { type: 'group', id: 'b', tabs: ['api'] },
        },
        'onUpdate:activeGroup': (value: string | undefined) => updates.push(value),
      },
      attachTo: document.body,
    })
    await nextTick()
    const [a, b] = wrapper.findAll('[data-dock-group]')
    await a!.find('[role="tab"]').trigger('pointerdown')
    await a!.find('[role="tab"]').trigger('focusin')
    await a!.find('[role="tab"]').trigger('pointerdown')
    await b!.find('[role="tab"]').trigger('pointerdown')
    await a!.find('[role="tab"]').trigger('focusin')
    expect(updates).toEqual(['a', 'b', 'a'])
    wrapper.unmount()
  })
})
