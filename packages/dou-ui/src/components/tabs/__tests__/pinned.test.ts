import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, markRaw, nextTick, ref } from 'vue'
import { DouTabPanel, DouTabs } from '../../../index'
import { pressTab } from '../tab-drag'
import type { TabsMoveEvent } from '../tabs'

const FileIcon = markRaw(defineComponent({ setup: () => () => h('svg', { class: 'icon-file' }) }))
const GitIcon = markRaw(defineComponent({ setup: () => () => h('svg', { class: 'icon-git' }) }))
const PlanIcon = markRaw(defineComponent({ setup: () => () => h('svg', { class: 'icon-plan' }) }))

const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouTabs pinned tabs', () => {
  it('renders pinned tabs outside the scrollable list, compact with icon tooltip and non-closable by default', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(
        defineComponent({
          setup() {
            const value = ref<string | number | undefined>('doc1')
            return () =>
              h(
                DouTabs,
                {
                  modelValue: value.value,
                  'onUpdate:modelValue': (v: string | number | undefined) => (value.value = v),
                  closable: true,
                },
                () => [
                  // intentionally interleaved order: pinned panel declared after regular panel
                  h(DouTabPanel, { value: 'doc1', label: '文档一' }, () => '文档一内容'),
                  h(
                    DouTabPanel,
                    { value: 'files', label: '文件', icon: FileIcon, pinned: true },
                    () => '文件内容',
                  ),
                  h(DouTabPanel, { value: 'overview', label: '总览', pinned: true }, () => '总览'),
                  h(
                    DouTabPanel,
                    {
                      value: 'git',
                      label: '变更',
                      icon: GitIcon,
                      pinned: true,
                      closable: true,
                    },
                    () => '变更内容',
                  ),
                  h(DouTabPanel, { value: 'doc2', label: '文档二' }, () => '文档二内容'),
                ],
              )
          },
        }),
        { attachTo: document.body },
      )
      await settle()

      const tablist = wrapper.get('[role="tablist"]')
      const pinned = wrapper.get('.dou-tabs__pinned')
      const list = wrapper.get('.dou-tabs__list')
      expect(tablist.element.contains(pinned.element)).toBe(true)
      expect(tablist.element.contains(list.element)).toBe(true)
      expect(pinned.classes()).toContain('is-divided')

      const pinnedTabs = pinned.findAll('[role="tab"]')
      const regularTabs = list.findAll('[role="tab"]')
      expect(pinnedTabs).toHaveLength(3)
      expect(regularTabs).toHaveLength(2)

      // pinned with icon renders compact icon-alone with aria-label and tooltip
      expect(pinnedTabs[0]!.classes()).toEqual(
        expect.arrayContaining(['is-pinned', 'is-icon-alone']),
      )
      expect(pinnedTabs[0]!.attributes('aria-label')).toBe('文件')
      expect(pinnedTabs[0]!.find('.dou-tabs__label').exists()).toBe(false)
      expect(pinnedTabs[0]!.find('.dou-tabs__close').exists()).toBe(false)

      // tooltip shows label on focus
      await pinnedTabs[0]!.trigger('focusin')
      vi.advanceTimersByTime(200)
      await nextTick()
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('文件')

      // pinned without icon keeps its text label and is still non-closable by default
      expect(pinnedTabs[1]!.classes()).toContain('is-pinned')
      expect(pinnedTabs[1]!.classes()).not.toContain('is-icon-alone')
      expect(pinnedTabs[1]!.text()).toBe('总览')
      expect(pinnedTabs[1]!.find('.dou-tabs__close').exists()).toBe(false)

      // explicit closable: true overrides pinned default
      expect(pinnedTabs[2]!.classes()).toContain('is-closable')
      expect(pinnedTabs[2]!.find('.dou-tabs__close').exists()).toBe(true)

      // aria-controls points to the corresponding panel
      const panel = wrapper.get(`#${pinnedTabs[0]!.attributes('aria-controls')}`)
      expect(panel.attributes('aria-labelledby')).toBe(pinnedTabs[0]!.attributes('id'))
      await pinnedTabs[0]!.trigger('click')
      await nextTick()
      expect(pinnedTabs[0]!.attributes('aria-selected')).toBe('true')
      expect(panel.attributes('hidden')).toBeUndefined()
      expect(panel.text()).toBe('文件内容')

      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps regular list scrollLeft intact when selecting a pinned tab and separates indicators', async () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const value = ref<string | number | undefined>('t5')
          return () =>
            h(
              DouTabs,
              {
                modelValue: value.value,
                'onUpdate:modelValue': (v: string | number | undefined) => (value.value = v),
              },
              () => [
                h(DouTabPanel, { value: 'files', label: '文件', icon: FileIcon, pinned: true }),
                h(DouTabPanel, { value: 'plan', label: '计划', icon: PlanIcon, pinned: true }),
                ...Array.from({ length: 8 }, (_, index) =>
                  h(DouTabPanel, { value: `t${index}`, label: `标签 ${index}` }),
                ),
              ],
            )
        },
      }),
      { attachTo: document.body },
    )
    await settle()

    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    let left = 240
    const scrollCalls: number[] = []
    Object.defineProperties(list, {
      clientWidth: { configurable: true, get: () => 200 },
      scrollWidth: { configurable: true, get: () => 800 },
      scrollLeft: {
        configurable: true,
        get: () => left,
        set: (value: number) => {
          left = value
        },
      },
    })
    list.scrollTo = ((options: ScrollToOptions) => {
      if (typeof options.left === 'number') {
        scrollCalls.push(options.left)
        left = options.left
      }
    }) as typeof list.scrollTo

    // click pinned tab: must NOT reset or scroll regular list
    const pinnedTabs = wrapper.findAll('.dou-tabs__pinned [role="tab"]')
    await pinnedTabs[0]!.trigger('click')
    await settle()
    expect(left).toBe(240)
    expect(scrollCalls).toHaveLength(0)

    // pinned indicator is visible while regular indicator is hidden
    expect(wrapper.get('.dou-tabs__pinned .dou-tabs__indicator').attributes('style')).not.toContain(
      'display: none',
    )
    expect(wrapper.get('.dou-tabs__list .dou-tabs__indicator').attributes('style')).toContain(
      'display: none',
    )

    // switch back to a regular tab: pinned indicator hides and regular indicator shows
    await wrapper.findAll('.dou-tabs__list [role="tab"]')[0]!.trigger('click')
    await settle()
    expect(wrapper.get('.dou-tabs__pinned .dou-tabs__indicator').attributes('style')).toContain(
      'display: none',
    )
    expect(wrapper.get('.dou-tabs__list .dou-tabs__indicator').attributes('style')).not.toContain(
      'display: none',
    )

    wrapper.unmount()
  })

  it('navigates seamlessly across pinned and regular tabs with keyboard and reorders within each zone', async () => {
    const items = ref([
      { value: 'files', label: '文件', icon: FileIcon, pinned: true },
      { value: 'doc1', label: '文档一', pinned: false },
      { value: 'plan', label: '计划', icon: PlanIcon, pinned: true },
      { value: 'doc2', label: '文档二', pinned: false },
    ])
    const current = ref<string | number | undefined>('files')
    const moves: TabsMoveEvent[] = []
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouTabs,
            {
              modelValue: current.value,
              'onUpdate:modelValue': (v: string | number | undefined) => (current.value = v),
              draggable: true,
              name: 'main',
              onMove: (event: TabsMoveEvent) => {
                moves.push(event)
                const next = [...items.value]
                const [moved] = next.splice(event.from.index, 1)
                next.splice(event.to.index, 0, moved!)
                items.value = next
              },
            },
            () => items.value.map((item) => h(DouTabPanel, { key: item.value, ...item })),
          ),
      }),
      { attachTo: document.body },
    )
    await settle()

    // visual tab order: files, plan (pinned) -> doc1, doc2 (regular)
    const allTabs = () => wrapper.findAll('[role="tab"]')
    expect(allTabs().map((tab) => tab.attributes('aria-label') ?? tab.text())).toEqual([
      '文件',
      '计划',
      '文档一',
      '文档二',
    ])

    // ArrowRight crosses from pinned into regular; End jumps to last regular; Home jumps to first pinned
    ;(allTabs()[0]!.element as HTMLElement).focus()
    await allTabs()[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(current.value).toBe('plan')
    await allTabs()[1]!.trigger('keydown', { key: 'ArrowRight' })
    expect(current.value).toBe('doc1')
    expect(document.activeElement).toBe(allTabs()[2]!.element)

    await allTabs()[2]!.trigger('keydown', { key: 'End' })
    expect(current.value).toBe('doc2')
    await allTabs()[3]!.trigger('keydown', { key: 'Home' })
    expect(current.value).toBe('files')

    // Alt+ArrowRight on pinned tab reorders inside pinned zone even with interleaved source array
    await allTabs()[0]!.trigger('keydown', { key: 'ArrowRight', altKey: true })
    await settle()
    expect(moves.at(-1)).toEqual({
      value: 'files',
      from: { name: 'main', index: 0 },
      to: { name: 'main', index: 2 },
    })
    expect(
      wrapper.findAll('.dou-tabs__pinned [role="tab"]').map((tab) => tab.attributes('aria-label')),
    ).toEqual(['计划', '文件'])
    expect(document.activeElement).toBe(
      wrapper.findAll('.dou-tabs__pinned [role="tab"]')[1]!.element,
    )

    // Alt+ArrowRight at end of pinned zone does not escape into regular zone
    const prevMoves = moves.length
    await wrapper
      .findAll('.dou-tabs__pinned [role="tab"]')[1]!
      .trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(moves).toHaveLength(prevMoves)

    // Alt+ArrowRight on regular tab reorders inside regular zone
    await allTabs()[2]!.trigger('keydown', { key: 'ArrowRight', altKey: true })
    await settle()
    expect(wrapper.findAll('.dou-tabs__list [role="tab"]').map((tab) => tab.text())).toEqual([
      '文档二',
      '文档一',
    ])

    wrapper.unmount()
  })

  it('shows pinned tabs above a divider in the overflow popover and keeps regular scroll stable', async () => {
    const current = ref<string | number | undefined>('t4')
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouTabs,
            {
              modelValue: current.value,
              'onUpdate:modelValue': (v: string | number | undefined) => (current.value = v),
              closable: true,
            },
            () => [
              h(DouTabPanel, { value: 'files', label: '文件', icon: FileIcon, pinned: true }),
              h(DouTabPanel, { value: 'git', label: '变更', icon: GitIcon, pinned: true }),
              ...Array.from({ length: 6 }, (_, index) =>
                h(DouTabPanel, { value: `t${index}`, label: `标签 ${index}` }),
              ),
            ],
          ),
      }),
      { attachTo: document.body },
    )
    await settle()

    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    let left = 180
    Object.defineProperties(list, {
      clientWidth: { configurable: true, get: () => 200 },
      scrollWidth: { configurable: true, get: () => 640 },
      scrollLeft: {
        configurable: true,
        get: () => left,
        set: (value: number) => {
          left = value
        },
      },
    })
    list.dispatchEvent(new Event('scroll'))
    await nextTick()

    await wrapper.get('.dou-tabs__overflow').trigger('click')
    await nextTick()
    await nextTick()

    const popover = document.querySelector<HTMLElement>('.dou-tabs__overflow-popover')!
    const items = popover.querySelectorAll<HTMLElement>('.dou-tabs__overflow-item')
    expect(items).toHaveLength(8)
    expect(items[0]!.classList).toContain('is-pinned')
    expect(items[0]!.querySelector('.dou-tabs__overflow-pin')).not.toBeNull()
    expect(items[0]!.querySelector('.dou-tabs__overflow-close')).toBeNull()
    expect(items[2]!.classList).not.toContain('is-pinned')
    expect(items[2]!.querySelector('.dou-tabs__overflow-close')).not.toBeNull()
    expect(popover.querySelector('[role="separator"].dou-tabs__overflow-divider')).not.toBeNull()

    // selecting a pinned item from the overflow popover switches to it without changing list.scrollLeft
    items[0]!.querySelector<HTMLButtonElement>('.dou-tabs__overflow-select')!.click()
    await settle()
    expect(current.value).toBe('files')
    expect(left).toBe(180)
    wrapper.unmount()
  })

  it('supports pointer dragging pinned tabs across groups and dropping regular tabs onto pinned-only tabs', async () => {
    const moves: TabsMoveEvent[] = []
    const target = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouTabs,
            {
              draggable: true,
              group: 'workspace',
              name: 'group-b',
              onMove: (event: TabsMoveEvent) => moves.push(event),
            },
            () => [
              h(DouTabPanel, { value: 'files', label: '文件', icon: FileIcon, pinned: true }),
              h(DouTabPanel, { value: 'git', label: '变更', icon: GitIcon, pinned: true }),
            ],
          ),
      }),
      { attachTo: document.body },
    )
    await settle()

    const header = target.get('.dou-tabs__header').element as HTMLElement
    const pinnedEl = target.get('.dou-tabs__pinned').element as HTMLElement
    const listEl = target.get('.dou-tabs__list').element as HTMLElement
    Object.defineProperties(pinnedEl, {
      scrollWidth: { configurable: true, get: () => 80 },
      clientWidth: { configurable: true, get: () => 80 },
    })
    Object.defineProperties(listEl, {
      scrollWidth: { configurable: true, get: () => 200 },
      clientWidth: { configurable: true, get: () => 200 },
    })
    const pinnedButtons = target.findAll('.dou-tabs__pinned [role="tab"]')
    vi.spyOn(pinnedButtons[0]!.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 32,
      height: 32,
      right: 32,
      bottom: 32,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    vi.spyOn(pinnedButtons[1]!.element, 'getBoundingClientRect').mockReturnValue({
      left: 36,
      top: 0,
      width: 32,
      height: 32,
      right: 68,
      bottom: 32,
      x: 36,
      y: 0,
      toJSON: () => {},
    })

    const origElementFromPoint = document.elementFromPoint
    document.elementFromPoint = () => header
    const origRaf = window.requestAnimationFrame
    const origCancelRaf = window.cancelAnimationFrame
    let rafCb: FrameRequestCallback | undefined
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    }) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = () => {}

    const sourceEl = document.createElement('button')
    document.body.append(sourceEl)

    try {
      // 1. Drag a pinned tab from another group over the middle of the pinned zone
      pressTab(new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 10 }), {
        el: sourceEl,
        root: sourceEl,
        drag: () => ({
          value: 'plan',
          label: '计划',
          group: 'workspace',
          name: 'group-a',
          index: 0,
          source: sourceEl,
          pinned: true,
        }),
      })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 10 }))
      rafCb?.(16)
      await nextTick()
      expect(target.get('.dou-tabs__pinned .dou-tabs__marker').attributes('style')).not.toContain(
        'display: none',
      )
      expect(target.get('.dou-tabs__list .dou-tabs__marker').attributes('style')).toContain(
        'display: none',
      )
      window.dispatchEvent(new PointerEvent('pointerup'))
      await nextTick()
      expect(moves.at(-1)).toEqual({
        value: 'plan',
        from: { name: 'group-a', index: 0 },
        to: { name: 'group-b', index: 1 },
      })

      // 2. Drag a regular tab over this pinned-only group: marker renders in empty .dou-tabs__list
      pressTab(new PointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 10 }), {
        el: sourceEl,
        root: sourceEl,
        drag: () => ({
          value: 'doc1',
          label: '文档一',
          group: 'workspace',
          name: 'group-a',
          index: 1,
          source: sourceEl,
          pinned: false,
        }),
      })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 10 }))
      rafCb?.(32)
      await nextTick()
      expect(target.get('.dou-tabs__pinned').classes()).toContain('is-divided')
      expect(target.get('.dou-tabs__list .dou-tabs__marker').attributes('style')).toContain(
        'translateX(1px)',
      )
      window.dispatchEvent(new PointerEvent('pointerup'))
      await nextTick()
      expect(moves.at(-1)).toEqual({
        value: 'doc1',
        from: { name: 'group-a', index: 1 },
        to: { name: 'group-b', index: 2 },
      })
    } finally {
      document.elementFromPoint = origElementFromPoint
      window.requestAnimationFrame = origRaf
      window.cancelAnimationFrame = origCancelRaf
      sourceEl.remove()
      target.unmount()
    }
  })
})
