import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouDock } from '../../../index'
import { pressTab } from '../../tabs/tab-drag'
import { splitDockTab } from '../layout'
import type { DockContext } from '../context'
import type { DockBeforeMoveContext, DockBeforeMoveResult, DockExpose } from '../dock'
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
  afterEach(() => {
    window.dispatchEvent(new PointerEvent('pointercancel'))
  })

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

  it('opens a tab dragged in from outside', async () => {
    const { wrapper, layout, events } = make()
    await nextTick()
    const [first] = wrapper.findAllComponents({ name: 'DouTabs' })
    // what a row of tabs reports for a new tab dragged in with `startDrop`
    first!.vm.$emit('move', { value: 'log', from: { index: -1 }, to: { name: 'a', index: 1 } })
    expect(layout.value.type === 'split' && layout.value.start).toMatchObject({
      tabs: ['thread', 'log', 'plan'],
      active: 'log',
    })
    expect(events.at(-1)).toEqual([
      'move',
      { value: 'log', from: null, to: { group: 'a', index: 1 } },
    ])
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

  it('switches and closes overflowing tabs of a group from its overflow popover', async () => {
    const { wrapper, layout, events } = make({ closable: true })
    await nextTick()
    const list = wrapper.get('[data-dock-group="a"] .dou-tabs__list').element as HTMLElement
    Object.defineProperties(list, {
      clientWidth: { configurable: true, get: () => 80 },
      scrollWidth: { configurable: true, get: () => 240 },
    })
    list.dispatchEvent(new Event('scroll'))
    await nextTick()

    await wrapper.get('[data-dock-group="a"] .dou-tabs__overflow').trigger('click')
    await nextTick()
    await nextTick()

    const popover = document.querySelector<HTMLElement>('.dou-tabs__overflow-popover')!
    const items = popover.querySelectorAll<HTMLElement>('.dou-tabs__overflow-item')
    expect(items).toHaveLength(2)
    items[1]!.querySelector<HTMLButtonElement>('.dou-tabs__overflow-select')!.click()
    await nextTick()
    expect(layout.value.type === 'split' && layout.value.start).toMatchObject({ active: 'plan' })

    await wrapper.get('[data-dock-group="a"] .dou-tabs__overflow').trigger('click')
    await nextTick()
    await nextTick()
    popover
      .querySelectorAll<HTMLElement>('.dou-tabs__overflow-item')[0]!
      .querySelector<HTMLButtonElement>('.dou-tabs__overflow-close')!
      .click()
    expect(events.at(-1)).toEqual(['remove', 'thread', 'a'])
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('supports pinned tabs with compact icons, reorder, and cross-group drops', async () => {
    const PinIconA = defineComponent({ setup: () => () => h('svg', { class: 'pin-icon-a' }) })
    const PinIconB = defineComponent({ setup: () => () => h('svg', { class: 'pin-icon-b' }) })
    const pinnedPanels = [
      { value: 'files', label: '文件', icon: PinIconA, pinned: true },
      { value: 'changes', label: '变更', icon: PinIconB, pinned: true },
      { value: 'thread', label: '需求讨论' },
      { value: 'plan', label: '发布计划' },
    ]
    const layout = ref<DockNode>({
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: { type: 'group', id: 'a', tabs: ['files', 'changes', 'thread'], active: 'thread' },
      end: { type: 'group', id: 'b', tabs: ['plan'], active: 'plan' },
    })
    const events: unknown[][] = []
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouDock,
            {
              panels: pinnedPanels,
              closable: true,
              modelValue: layout.value,
              'onUpdate:modelValue': (value: DockNode) => (layout.value = value),
              onMove: (e: unknown) => events.push(['move', e]),
            },
            { default: ({ value }: { value: string }) => `${value} 内容` },
          ),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const groupA = wrapper.get('[data-dock-group="a"]')
    const pinnedTabs = groupA.findAll('.dou-tabs__pinned [role="tab"]')
    const regularTabs = groupA.findAll('.dou-tabs__list [role="tab"]')
    expect(pinnedTabs).toHaveLength(2)
    expect(regularTabs).toHaveLength(1)
    expect(pinnedTabs[0]!.classes()).toContain('is-pinned')
    expect(pinnedTabs[0]!.classes()).toContain('is-icon-alone')
    expect(pinnedTabs[0]!.attributes('aria-label')).toBe('文件')
    // pinned tabs are not closable by default even when dock has closable: true
    expect(pinnedTabs[0]!.find('.dou-tabs__close').exists()).toBe(false)
    expect(regularTabs[0]!.find('.dou-tabs__close').exists()).toBe(true)

    // keyboard reorder within pinned area
    await pinnedTabs[0]!.trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(layout.value.type === 'split' && layout.value.start).toMatchObject({
      tabs: ['changes', 'files', 'thread'],
    })
    expect(events.at(-1)).toEqual([
      'move',
      { value: 'files', from: { group: 'a', index: 0 }, to: { group: 'a', index: 1 } },
    ])

    // cross-group move of a pinned tab into group b (which has no pinned tabs yet)
    const [, secondTabs] = wrapper.findAllComponents({ name: 'DouTabs' })
    secondTabs!.vm.$emit('move', {
      value: 'files',
      from: { name: 'a', index: 1 },
      to: { name: 'b', index: 0 },
    })
    await nextTick()
    expect(layout.value.type === 'split' && layout.value.end).toMatchObject({
      tabs: ['files', 'plan'],
      active: 'files',
    })
    expect(wrapper.findAll('[data-dock-group="b"] .dou-tabs__pinned [role="tab"]')).toHaveLength(1)

    wrapper.unmount()
  })

  it('merges tabs sharing a `mergeId` on cross-group move, center drop, and external drop', async () => {
    const FileIcon = defineComponent({ setup: () => () => h('svg') })
    const mergePanels = [
      { value: 'files', label: '文件列表', icon: FileIcon, pinned: true, mergeId: 'files' },
      { value: 'files-disabled', label: '禁用副本', disabled: true, mergeId: 'files' },
      { value: 'files-reg', label: '普通副本', mergeId: 'files' },
      { value: 'spec', label: '接口规范' },
      { value: 'files-copy', label: '文件列表（分栏）', icon: FileIcon, mergeId: 'files' },
      { value: 'notes', label: '纪要' },
    ]
    const layout = ref<DockNode>({
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: {
        type: 'group',
        id: 'main',
        tabs: ['files', 'files-reg', 'spec'],
        active: 'spec',
      },
      end: {
        type: 'group',
        id: 'side',
        tabs: ['files-copy'],
        active: 'files-copy',
      },
    })
    const activeGroup = ref<string | undefined>('side')
    const events: unknown[][] = []
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouDock,
            {
              panels: mergePanels,
              modelValue: layout.value,
              'onUpdate:modelValue': (value: DockNode) => (layout.value = value),
              activeGroup: activeGroup.value,
              'onUpdate:activeGroup': (value: string | undefined) => (activeGroup.value = value),
              onMove: (e: unknown) => events.push(['move', e]),
              onSplit: (e: unknown) => events.push(['split', e]),
            },
            { default: ({ value }: { value: string }) => `${value} 内容` },
          ),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    // cross-group tab bar move: prefers pinned match `files` over `files-reg`, collapses empty `side`
    const [mainTabs] = wrapper.findAllComponents({ name: 'DouTabs' })
    mainTabs!.vm.$emit('move', {
      value: 'files-copy',
      from: { name: 'side', index: 0 },
      to: { name: 'main', index: 3 },
    })
    await nextTick()
    expect(layout.value).toEqual({
      type: 'group',
      id: 'main',
      tabs: ['files', 'files-reg', 'spec'],
      active: 'files',
    })
    expect(activeGroup.value).toBe('main')
    expect(events.at(-1)).toEqual([
      'move',
      {
        value: 'files-copy',
        from: { group: 'side', index: 0 },
        to: { group: 'main', index: 0 },
        mergedInto: 'files',
      },
    ])

    // external drop matching `mergeId` activates target without inserting duplicate
    layout.value = { type: 'group', id: 'main', tabs: ['files', 'spec'], active: 'spec' }
    await nextTick()
    mainTabs!.vm.$emit('move', {
      value: 'files-copy',
      from: { index: -1 },
      to: { name: 'main', index: 2 },
    })
    await nextTick()
    expect(layout.value).toEqual({
      type: 'group',
      id: 'main',
      tabs: ['files', 'spec'],
      active: 'files',
    })
    expect(events.at(-1)).toEqual([
      'move',
      {
        value: 'files-copy',
        from: null,
        to: { group: 'main', index: 0 },
        mergedInto: 'files',
      },
    ])

    // center body drop merges; edge split does NOT merge; disabled matches are skipped
    layout.value = {
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: { type: 'group', id: 'main', tabs: ['files-disabled', 'spec'], active: 'spec' },
      end: { type: 'group', id: 'side', tabs: ['files-copy', 'notes'], active: 'files-copy' },
    }
    await nextTick()
    const [mainGroup] = wrapper.findAllComponents({ name: 'DouDockGroup' })
    const { dock } = (mainGroup!.vm.$ as unknown as { setupState: { dock: DockContext } })
      .setupState
    const drag = {
      value: 'files-copy',
      label: '文件列表（分栏）',
      group: dock.group,
      name: 'side',
      index: 0,
      source: {},
    }
    // only disabled match exists -> inserts normally instead of activating disabled tab
    dock.drop(drag, mainGroup!.props('group'), 'center')
    await nextTick()
    expect(layout.value.type === 'split' && layout.value.start).toMatchObject({
      tabs: ['files-disabled', 'spec', 'files-copy'],
      active: 'files-copy',
    })
    expect((events.at(-1)![1] as { mergedInto?: unknown }).mergedInto).toBeUndefined()

    // edge split splits off without merging even when a matching pinned tab is in target
    layout.value = {
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: { type: 'group', id: 'main', tabs: ['files', 'spec'], active: 'spec' },
      end: { type: 'group', id: 'side', tabs: ['files-copy', 'notes'], active: 'files-copy' },
    }
    await nextTick()
    const [mainGroup2] = wrapper.findAllComponents({ name: 'DouDockGroup' })
    dock.drop(drag, mainGroup2!.props('group'), 'right')
    await nextTick()
    expect(events.at(-1)![0]).toBe('split')

    // center body drop onto group containing active-capable match merges and activates it
    layout.value = {
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: { type: 'group', id: 'main', tabs: ['files', 'spec'], active: 'spec' },
      end: { type: 'group', id: 'side', tabs: ['files-copy', 'notes'], active: 'files-copy' },
    }
    await nextTick()
    const [mainGroup3] = wrapper.findAllComponents({ name: 'DouDockGroup' })
    dock.drop(drag, mainGroup3!.props('group'), 'center')
    await nextTick()
    expect(layout.value.type === 'split' && layout.value.start).toMatchObject({
      tabs: ['files', 'spec'],
      active: 'files',
    })
    expect(layout.value.type === 'split' && layout.value.end).toMatchObject({
      tabs: ['notes'],
      active: 'notes',
    })
    expect(events.at(-1)).toEqual([
      'move',
      {
        value: 'files-copy',
        from: { group: 'side', index: 0 },
        to: { group: 'main', index: 0 },
        mergedInto: 'files',
      },
    ])

    // reordering within the same group does NOT auto-merge tabs with same mergeId
    layout.value = {
      type: 'group',
      id: 'main',
      tabs: ['files-reg', 'files-copy'],
      active: 'files-reg',
    }
    await nextTick()
    const [onlyTabs] = wrapper.findAllComponents({ name: 'DouTabs' })
    onlyTabs!.vm.$emit('move', {
      value: 'files-copy',
      from: { name: 'main', index: 1 },
      to: { name: 'main', index: 0 },
    })
    await nextTick()
    expect(layout.value).toEqual({
      type: 'group',
      id: 'main',
      tabs: ['files-copy', 'files-reg'],
      active: 'files-copy',
    })
    expect((events.at(-1)![1] as { mergedInto?: unknown }).mergedInto).toBeUndefined()

    wrapper.unmount()
  })

  it('supports `beforeMove` to cancel, merge dynamically, or opt out of `mergeId`', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const seen: DockBeforeMoveContext[] = []
    let result: DockBeforeMoveResult
    const beforeMove = (ctx: DockBeforeMoveContext): DockBeforeMoveResult => {
      seen.push(ctx)
      return result
    }
    const { wrapper, layout, events } = make({
      panels: [
        { value: 'thread', label: '需求讨论', mergeId: 'same' },
        { value: 'plan', label: '发布计划' },
        { value: 'api', label: '接口文档', mergeId: 'same' },
      ],
      beforeMove,
    })
    await nextTick()

    const [tabsA] = wrapper.findAllComponents({ name: 'DouTabs' })

    // 1. returning false cancels the move
    result = false
    tabsA!.vm.$emit('move', {
      value: 'api',
      from: { name: 'b', index: 0 },
      to: { name: 'a', index: 2 },
    })
    await nextTick()
    expect(seen.at(-1)).toMatchObject({
      value: 'api',
      from: { group: 'b', index: 0 },
      to: { group: 'a', index: 2 },
      mergeInto: 'thread',
    })
    expect(events).toEqual([])
    expect(layout.value.type).toBe('split')

    // 2. returning { mergeInto: null } skips automatic mergeId and moves normally
    result = { mergeInto: null }
    tabsA!.vm.$emit('move', {
      value: 'api',
      from: { name: 'b', index: 0 },
      to: { name: 'a', index: 1 },
    })
    await nextTick()
    expect(layout.value).toEqual({
      type: 'group',
      id: 'a',
      tabs: ['thread', 'api', 'plan'],
      active: 'api',
    })
    expect(events.at(-1)).toEqual([
      'move',
      { value: 'api', from: { group: 'b', index: 0 }, to: { group: 'a', index: 1 } },
    ])

    // 3. returning { mergeInto } merges dynamically even without matching mergeId
    layout.value = {
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: { type: 'group', id: 'a', tabs: ['thread', 'plan'], active: 'thread' },
      end: { type: 'group', id: 'b', tabs: ['api'], active: 'api' },
    }
    await nextTick()
    result = { mergeInto: 'plan' }
    tabsA!.vm.$emit('move', {
      value: 'api',
      from: { name: 'b', index: 0 },
      to: { name: 'a', index: 2 },
    })
    await nextTick()
    expect(layout.value).toEqual({
      type: 'group',
      id: 'a',
      tabs: ['thread', 'plan'],
      active: 'plan',
    })
    expect(events.at(-1)).toEqual([
      'move',
      {
        value: 'api',
        from: { group: 'b', index: 0 },
        to: { group: 'a', index: 1 },
        mergedInto: 'plan',
      },
    ])

    // 4. invalid mergeInto warns and cancels cleanly
    layout.value = {
      type: 'split',
      direction: 'horizontal',
      size: 60,
      start: { type: 'group', id: 'a', tabs: ['thread'], active: 'thread' },
      end: { type: 'group', id: 'b', tabs: ['api'], active: 'api' },
    }
    await nextTick()
    const countBefore = events.length
    result = { mergeInto: 'not-here' }
    tabsA!.vm.$emit('move', {
      value: 'api',
      from: { name: 'b', index: 0 },
      to: { name: 'a', index: 1 },
    })
    await nextTick()
    expect(events).toHaveLength(countBefore)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not-here'))

    warn.mockRestore()
    wrapper.unmount()
  })

  it('highlights the merge target tab while dragging over target tab bar or center body', async () => {
    const FileIcon = defineComponent({ setup: () => () => h('svg') })
    const layout = ref<DockNode>({
      type: 'split',
      direction: 'horizontal',
      size: 50,
      start: { type: 'group', id: 'main', tabs: ['files', 'spec'], active: 'spec' },
      end: { type: 'group', id: 'side', tabs: ['files-copy'], active: 'files-copy' },
    })
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouDock, {
            panels: [
              { value: 'files', label: '文件列表', icon: FileIcon, pinned: true, mergeId: 'files' },
              { value: 'spec', label: '接口规范' },
              { value: 'files-copy', label: '文件副本', mergeId: 'files' },
            ],
            modelValue: layout.value,
            'onUpdate:modelValue': (value: DockNode) => (layout.value = value),
          }),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const mainGroup = wrapper.get('[data-dock-group="main"]')
    const mainHeader = mainGroup.get('.dou-tabs__header').element as HTMLElement
    const mainBody = mainGroup.element as HTMLElement
    const pinnedTab = mainGroup.get('.dou-tabs__pinned [role="tab"]')
    const sideTab = wrapper.get('[data-dock-group="side"] [role="tab"]').element as HTMLElement
    const dockCtx = (
      wrapper.findComponent({ name: 'DouDockGroup' }).vm.$ as unknown as {
        setupState: { dock: DockContext }
      }
    ).setupState.dock

    vi.spyOn(mainBody, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    const origElementFromPoint = document.elementFromPoint
    const origRaf = window.requestAnimationFrame
    const origCancelRaf = window.cancelAnimationFrame
    const raf: { cb: FrameRequestCallback | null } = { cb: null }
    let hovered: Element = mainHeader
    document.elementFromPoint = () => hovered
    window.requestAnimationFrame = (cb) => {
      raf.cb = cb
      return 1
    }
    window.cancelAnimationFrame = () => {
      raf.cb = null
    }

    try {
      const down = new PointerEvent('pointerdown', { button: 0, clientX: 500, clientY: 16 })
      pressTab(down, {
        el: sideTab,
        root: sideTab,
        drag: () => ({
          value: 'files-copy',
          label: '文件副本',
          group: dockCtx.group,
          name: 'side',
          index: 0,
          source: sideTab,
          pinned: false,
        }),
      })

      // 1. hover main tab bar -> pinned `files` tab highlights, no insertion marker
      hovered = mainHeader
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 16 }))
      raf.cb?.(16)
      await nextTick()
      expect(pinnedTab.classes()).toContain('is-merge-target')
      expect(mainGroup.get('.dou-tabs__list .dou-tabs__marker').attributes('style')).toContain(
        'display: none',
      )

      // 2. hover main group center body -> pinned `files` tab stays highlighted
      hovered = mainBody
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 150 }))
      raf.cb?.(32)
      await nextTick()
      expect(pinnedTab.classes()).toContain('is-merge-target')

      // 3. hover main group right edge (split) -> merge highlight clears
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 390, clientY: 150 }))
      raf.cb?.(48)
      await nextTick()
      expect(pinnedTab.classes()).not.toContain('is-merge-target')

      // 4. move back to center and drop -> merges and collapses side group
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 150 }))
      raf.cb?.(64)
      await nextTick()
      window.dispatchEvent(new PointerEvent('pointerup'))
      await nextTick()
      expect(layout.value).toEqual({
        type: 'group',
        id: 'main',
        tabs: ['files', 'spec'],
        active: 'files',
      })
      expect(pinnedTab.classes()).not.toContain('is-merge-target')
    } finally {
      document.elementFromPoint = origElementFromPoint
      window.requestAnimationFrame = origRaf
      window.cancelAnimationFrame = origCancelRaf
      wrapper.unmount()
    }
  })

  it('shows native hover titles for truncated tab labels inside DouDock', async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouDock, {
            panels: [
              { value: 'short', label: '概览' },
              { value: 'long', label: '上海站点多标签分栏工作区交互评审与验收记录' },
            ],
            modelValue: { type: 'group', id: 'main', tabs: ['short', 'long'] } satisfies DockNode,
          }),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const [shortTab, longTab] = wrapper.findAll('[role="tab"]')
    const shortLabel = shortTab!.get('.dou-tabs__label').element
    const longLabel = longTab!.get('.dou-tabs__label').element
    Object.defineProperties(shortLabel, {
      clientWidth: { configurable: true, get: () => 50 },
      scrollWidth: { configurable: true, get: () => 50 },
    })
    Object.defineProperties(longLabel, {
      clientWidth: { configurable: true, get: () => 140 },
      scrollWidth: { configurable: true, get: () => 310 },
    })

    await shortTab!.trigger('pointerenter')
    await longTab!.trigger('pointerenter')
    expect(shortTab!.attributes('title')).toBeUndefined()
    expect(longTab!.attributes('title')).toBe('上海站点多标签分栏工作区交互评审与验收记录')

    wrapper.unmount()
  })

  it('does not select the dragged tab when same-group reorder is cancelled by `beforeMove`', async () => {
    const layout = ref<DockNode>({
      type: 'group',
      id: 'a',
      tabs: ['thread', 'plan'],
      active: 'thread',
    })
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouDock, {
            panels,
            modelValue: layout.value,
            'onUpdate:modelValue': (value: DockNode) => (layout.value = value),
            beforeMove: () => false,
          }),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const header = wrapper.get('.dou-tabs__header').element as HTMLElement
    const [tab0, tab1] = wrapper.findAll('[role="tab"]')
    vi.spyOn(tab0!.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 100,
      bottom: 32,
      width: 100,
      height: 32,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    vi.spyOn(tab1!.element, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 0,
      right: 200,
      bottom: 32,
      width: 100,
      height: 32,
      x: 100,
      y: 0,
      toJSON: () => {},
    })

    const origElementFromPoint = document.elementFromPoint
    const origRaf = window.requestAnimationFrame
    const origCancelRaf = window.cancelAnimationFrame
    const raf: { cb: FrameRequestCallback | null } = { cb: null }
    document.elementFromPoint = () => header
    window.requestAnimationFrame = (cb) => {
      raf.cb = cb
      return 1
    }
    window.cancelAnimationFrame = () => {
      raf.cb = null
    }
    try {
      await tab1!.trigger('pointerdown', { button: 0, clientX: 150, clientY: 16 })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 16 }))
      raf.cb?.(16)
      await nextTick()
      window.dispatchEvent(new PointerEvent('pointerup'))
      await nextTick()
      await nextTick()
      expect(layout.value).toEqual({
        type: 'group',
        id: 'a',
        tabs: ['thread', 'plan'],
        active: 'thread',
      })
    } finally {
      document.elementFromPoint = origElementFromPoint
      window.requestAnimationFrame = origRaf
      window.cancelAnimationFrame = origCancelRaf
      wrapper.unmount()
    }
  })
})
