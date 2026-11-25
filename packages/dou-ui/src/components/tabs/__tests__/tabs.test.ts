import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouStatusDot, DouTabPanel, DouTabs } from '../../../index'

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

  it('renders an eager panel before it is shown', async () => {
    const wrapper = mount({
      components: { DouTabs, DouTabPanel },
      template: `
        <DouTabs>
          <DouTabPanel value="a" label="甲">甲的内容</DouTabPanel>
          <DouTabPanel value="b" label="乙" eager>乙的内容</DouTabPanel>
        </DouTabs>`,
    })
    await nextTick()
    const panels = wrapper.findAll('[role="tabpanel"]')
    expect(panels[1]!.text()).toBe('乙的内容')
    expect(panels[1]!.attributes('hidden')).toBeDefined()
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

function setWidths(el: HTMLElement, clientWidth: number, scrollWidth: number) {
  Object.defineProperties(el, {
    clientWidth: { configurable: true, get: () => clientWidth },
    scrollWidth: { configurable: true, get: () => scrollWidth },
  })
}

function wheelWithModifier(modifier: 'ctrlKey' | 'metaKey') {
  const event = new WheelEvent('wheel', { deltaY: 60, deltaX: 0, cancelable: true })
  Object.defineProperty(event, modifier, { value: true })
  return event
}

/** Give the tab list a layout: `clientWidth` wide, `scrollWidth` of tabs, each tab 100px. */
function layout(list: HTMLElement, options: { clientWidth?: number; scrollWidth?: number } = {}) {
  let left = 0
  let clientWidth = options.clientWidth ?? 300
  let scrollWidth = options.scrollWidth ?? 900
  Object.defineProperties(list, {
    clientWidth: { configurable: true, get: () => clientWidth },
    scrollWidth: { configurable: true, get: () => scrollWidth },
    scrollLeft: {
      configurable: true,
      get: () => left,
      set: (v: number) => {
        left = v
      },
    },
  })
  const calls: { to: number[] } = { to: [] }
  list.scrollTo = ((scrollOptions: ScrollToOptions) => {
    calls.to.push(scrollOptions.left!)
    left = scrollOptions.left!
  }) as typeof list.scrollTo
  // tabs are matched by their label, since a re-render may replace them
  const proto = HTMLButtonElement.prototype
  Object.defineProperties(proto, {
    offsetLeft: {
      configurable: true,
      get(this: HTMLElement) {
        const index = /标签 (\d)/.exec(this.textContent ?? '')?.[1]
        return index === undefined ? 0 : Number(index) * 100
      },
    },
    offsetWidth: { configurable: true, get: () => 100 },
  })
  return {
    calls,
    get left() {
      return left
    },
    resize(nextClientWidth: number, nextScrollWidth = scrollWidth) {
      clientWidth = nextClientWidth
      scrollWidth = nextScrollWidth
      list.dispatchEvent(new Event('scroll'))
    },
    scrollTo(value: number) {
      left = value
      list.dispatchEvent(new Event('scroll'))
    },
  }
}

const manyTabs = (value: string, props: Record<string, unknown> = {}) =>
  mount(
    defineComponent({
      setup() {
        const current = ref<string | number | undefined>(value)
        return () =>
          h(
            DouTabs,
            {
              ...props,
              modelValue: current.value,
              'onUpdate:modelValue': (v: string | number | undefined) => (current.value = v),
            },
            {
              default: () =>
                Array.from({ length: 9 }, (_, index) =>
                  h(
                    DouTabPanel,
                    {
                      value: `t${index}`,
                      label: `标签 ${index}`,
                      disabled: index === 2,
                      closable: index === 0 ? false : undefined,
                    },
                    () => `内容 ${index}`,
                  ),
                ),
              ...(props.withExtra
                ? { extra: () => h('span', { class: 'probe-extra' }, '更多') }
                : {}),
            },
          )
      },
    }),
    { attachTo: document.body },
  )

describe('DouTabs overflow', () => {
  afterEach(() => {
    const proto = HTMLButtonElement.prototype as unknown as Record<string, unknown>
    delete proto.offsetLeft
    delete proto.offsetWidth
    document.body.innerHTML = ''
  })

  it('fades the edges and shows a single overflow button before add and extra', async () => {
    const wrapper = manyTabs('t0', { addable: true, withExtra: true })
    await nextTick()
    await nextTick()
    const tablist = wrapper.get('[role="tablist"]').element as HTMLElement
    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    const { scrollTo, resize } = layout(list)
    scrollTo(0)
    await nextTick()

    expect(list.classList).toContain('is-fade-end')
    expect(list.classList).not.toContain('is-fade-start')
    expect(wrapper.find('.dou-tabs__scroll').exists()).toBe(false)
    expect(wrapper.findAll('.dou-tabs__overflow')).toHaveLength(1)

    const children = [...wrapper.get('.dou-tabs__header').element.children]
    const listIndex = children.indexOf(tablist)
    const overflowIndex = children.indexOf(wrapper.get('.dou-tabs__overflow').element)
    const addIndex = children.indexOf(wrapper.get('.dou-tabs__add').element)
    const extraIndex = children.indexOf(wrapper.get('.dou-tabs__extra').element)
    expect(listIndex).toBeLessThan(overflowIndex)
    expect(overflowIndex).toBeLessThan(addIndex)
    expect(addIndex).toBeLessThan(extraIndex)

    scrollTo(600)
    await nextTick()
    expect(list.classList).toContain('is-fade-start')
    expect(list.classList).not.toContain('is-fade-end')
    expect(wrapper.findAll('.dou-tabs__overflow')).toHaveLength(1)

    // hides automatically once the row fits again
    resize(1000, 900)
    await nextTick()
    expect(wrapper.find('.dou-tabs__overflow').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the overflow button even in a narrow header', async () => {
    const wrapper = manyTabs('t0')
    const header = wrapper.get('.dou-tabs__header').element as HTMLElement
    Object.defineProperty(header, 'clientWidth', { configurable: true, value: 120 })
    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    const { scrollTo } = layout(list, { clientWidth: 100, scrollWidth: 900 })
    scrollTo(0)
    await nextTick()
    expect(list.classList).toContain('is-fade-end')
    expect(wrapper.find('.dou-tabs__overflow').exists()).toBe(true)
    wrapper.unmount()
  })

  it('has no overflow button when the tabs fit', async () => {
    const wrapper = make()
    await nextTick()
    expect(wrapper.find('.dou-tabs__overflow').exists()).toBe(false)
    wrapper.unmount()
  })

  it('scrolls the selected tab into view, clear of the faded edge', async () => {
    const wrapper = mount(DouTabs, {
      props: { modelValue: 't0' },
      slots: {
        default: () =>
          Array.from({ length: 9 }, (_, index) =>
            h(DouTabPanel, { value: `t${index}`, label: `标签 ${index}` }, () => `内容 ${index}`),
          ),
      },
      attachTo: document.body,
    })
    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    const { calls } = layout(list)
    await wrapper.setProps({ modelValue: 't6' })
    await nextTick()
    await nextTick()
    // tab 6 ends at 700: 700 + 32 - 300
    expect(calls.to.at(-1)).toBe(432)
    wrapper.unmount()
  })

  it('converts vertical wheel deltaY to horizontal scroll when overflowing', async () => {
    const wrapper = manyTabs('t0')
    await nextTick()
    await nextTick()
    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    const state = layout(list)
    state.scrollTo(0)
    await nextTick()

    const down = new WheelEvent('wheel', { deltaY: 120, deltaX: 0, cancelable: true })
    list.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(state.left).toBe(120)
    await nextTick()
    expect(list.classList).toContain('is-fade-start')
    expect(list.classList).toContain('is-fade-end')

    // DOM_DELTA_LINE scales to pixels
    const lineDown = new WheelEvent('wheel', {
      deltaY: 5,
      deltaX: 0,
      deltaMode: 1,
      cancelable: true,
    })
    list.dispatchEvent(lineDown)
    expect(lineDown.defaultPrevented).toBe(true)
    expect(state.left).toBe(200)

    // native horizontal wheel / trackpad gesture is not intercepted
    const horizontal = new WheelEvent('wheel', { deltaX: 40, deltaY: 0, cancelable: true })
    list.dispatchEvent(horizontal)
    expect(horizontal.defaultPrevented).toBe(false)
    expect(state.left).toBe(200)

    // zoom gestures with ctrlKey or metaKey are not intercepted
    const ctrlZoom = wheelWithModifier('ctrlKey')
    list.dispatchEvent(ctrlZoom)
    expect(ctrlZoom.defaultPrevented).toBe(false)

    const metaZoom = wheelWithModifier('metaKey')
    list.dispatchEvent(metaZoom)
    expect(metaZoom.defaultPrevented).toBe(false)

    // does not intercept when there is no horizontal overflow
    state.resize(1000, 900)
    const noOverflow = new WheelEvent('wheel', { deltaY: 120, deltaX: 0, cancelable: true })
    list.dispatchEvent(noOverflow)
    expect(noOverflow.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('opens a vertical tab list popover to switch, close and respect beforeLeave', async () => {
    const ProbeIcon = defineComponent({ setup: () => () => h('svg', { class: 'probe-icon' }) })
    let allow = false
    const current = ref<string | number | undefined>('t0')
    const removed: unknown[] = []
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouTabs,
            {
              modelValue: current.value,
              'onUpdate:modelValue': (v: string | number | undefined) => (current.value = v),
              closable: true,
              beforeLeave: async () => allow,
              onRemove: (v: string | number) => removed.push(v),
            },
            () => [
              h(DouTabPanel, { value: 't0', label: '标签 0', icon: ProbeIcon, closable: false }),
              h(
                DouTabPanel,
                { value: 't1', label: '标签 1' },
                {
                  label: ({ selected }: { selected: boolean }) => `自定义 1${selected ? '*' : ''}`,
                },
              ),
              h(DouTabPanel, { value: 't2', label: '标签 2', disabled: true }),
              ...Array.from({ length: 6 }, (_, i) =>
                h(DouTabPanel, { value: `t${i + 3}`, label: `标签 ${i + 3}` }),
              ),
            ],
          ),
      }),
      { attachTo: document.body },
    )
    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    const { calls, scrollTo } = layout(list)
    scrollTo(0)
    await nextTick()

    await wrapper.get('.dou-tabs__overflow').trigger('click')
    await nextTick()
    await nextTick()

    const popover = document.querySelector<HTMLElement>('.dou-tabs__overflow-popover')
    expect(popover).not.toBeNull()
    expect(popover!.style.display).not.toBe('none')

    const items = [...popover!.querySelectorAll<HTMLElement>('.dou-tabs__overflow-item')]
    expect(items).toHaveLength(9)
    // active item, icon, custom #label slot, disabled state
    expect(items[0]!.classList).toContain('is-selected')
    expect(items[0]!.querySelector('.dou-tabs__overflow-icon.probe-icon')).not.toBeNull()
    expect(items[0]!.querySelector('.dou-tabs__overflow-check')).not.toBeNull()
    expect(items[0]!.querySelector('.dou-tabs__overflow-close')).toBeNull()
    expect(items[1]!.querySelector('.dou-tabs__overflow-label')?.textContent).toBe('自定义 1')
    expect(items[1]!.querySelector('.dou-tabs__overflow-close')).not.toBeNull()
    expect(items[2]!.classList).toContain('is-disabled')
    expect(items[2]!.querySelector<HTMLButtonElement>('.dou-tabs__overflow-select')?.disabled).toBe(
      true,
    )
    expect(items[2]!.querySelector('.dou-tabs__overflow-close')).toBeNull()

    // closing from the popover emits remove without selecting or closing the popover
    items[1]!.querySelector<HTMLButtonElement>('.dou-tabs__overflow-close')!.click()
    await nextTick()
    expect(removed).toEqual(['t1'])
    expect(current.value).toBe('t0')
    expect(popover!.style.display).not.toBe('none')

    // blocked by beforeLeave: does not switch or close
    items[6]!.querySelector<HTMLButtonElement>('.dou-tabs__overflow-select')!.click()
    await new Promise((done) => setTimeout(done))
    await nextTick()
    expect(current.value).toBe('t0')
    expect(popover!.style.display).not.toBe('none')

    // allowed by beforeLeave: switches, scrolls selected tab into view, and closes popover
    allow = true
    items[6]!.querySelector<HTMLButtonElement>('.dou-tabs__overflow-select')!.click()
    await new Promise((done) => setTimeout(done))
    await nextTick()
    await nextTick()
    expect(current.value).toBe('t6')
    expect(popover!.style.display).toBe('none')
    expect(calls.to.at(-1)).toBe(432)
    wrapper.unmount()
  })

  it('supports keyboard navigation, closing and escape in the overflow popover', async () => {
    const wrapper = manyTabs('t0', { closable: true })
    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    const { scrollTo } = layout(list)
    scrollTo(0)
    await nextTick()

    const trigger = wrapper.get('.dou-tabs__overflow')
    ;(trigger.element as HTMLElement).focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const popover = document.querySelector<HTMLElement>('.dou-tabs__overflow-popover')!
    const buttons = () => [
      ...popover.querySelectorAll<HTMLButtonElement>('.dou-tabs__overflow-select'),
    ]
    expect(document.activeElement).toBe(buttons()[0])

    // ArrowDown skips disabled t2 when stepping from t1
    buttons()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(buttons()[1])
    buttons()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(buttons()[3])

    // Delete triggers remove on a closable item
    const tabs = wrapper.findComponent(DouTabs)
    buttons()[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    expect(tabs.emitted('remove')).toEqual([['t3']])

    // End / Home jump to last / first enabled item
    buttons()[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(buttons()[8])
    buttons()[8]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(buttons()[0])

    // Escape closes the popover and returns focus to the trigger
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(popover.style.display).toBe('none')
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('measures the underline again when the selected tab grows on its own', async () => {
    let callback: ResizeObserverCallback | undefined
    const observed = new Set<Element>()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          callback = cb
        }
        observe(el: Element) {
          observed.add(el)
        }
        unobserve(el: Element) {
          observed.delete(el)
        }
        disconnect() {
          observed.clear()
        }
      },
    )
    const width = { value: 32 }
    const offset = vi
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockImplementation(() => width.value)
    try {
      const wrapper = make({ modelValue: 'logs' })
      await nextTick()
      await nextTick()
      await nextTick()
      const tabs = wrapper.findAll('[role="tab"]')
      expect(observed.has(tabs[1]!.element)).toBe(true)
      const indicator = wrapper.find('.dou-tabs__indicator')
      expect(indicator.attributes('style')).toContain('width: 32px')
      // its label comes in later; the row keeps its size
      width.value = 135
      callback!([], {} as ResizeObserver)
      await nextTick()
      expect(indicator.attributes('style')).toContain('width: 135px')
      // only the selected tab is watched
      await tabs[3]!.trigger('click')
      await nextTick()
      await nextTick()
      expect(observed.has(tabs[1]!.element)).toBe(false)
      expect(observed.has(tabs[3]!.element)).toBe(true)
      wrapper.unmount()
    } finally {
      offset.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('shows a native title on hover only when a tab label overflows', async () => {
    const longTitle = ref('上海前端基础设施架构评审与排期说明')
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouTabs, { closable: true }, () => [
            h(DouTabPanel, { value: 'short', label: '概览' }),
            h(DouTabPanel, { value: 'long', label: longTitle.value }),
          ]),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const tabs = wrapper.findAll('[role="tab"]')
    const shortTab = tabs[0]!
    const longTab = tabs[1]!
    const shortLabel = shortTab.get('.dou-tabs__label')
    const longLabel = longTab.get('.dou-tabs__label')
    const shortSize = { scrollWidth: 40, clientWidth: 40 }
    const longSize = { scrollWidth: 160, clientWidth: 160 }
    for (const [el, size] of [
      [shortLabel.element, shortSize],
      [longLabel.element, longSize],
    ] as const) {
      for (const key of ['scrollWidth', 'clientWidth'] as const) {
        Object.defineProperty(el, key, { configurable: true, get: () => size[key] })
      }
    }

    // not truncated: no native title, close button has no empty title suppression
    await shortTab.trigger('pointerenter')
    await longTab.trigger('pointerenter')
    expect(shortTab.attributes('title')).toBeUndefined()
    expect(longTab.attributes('title')).toBeUndefined()
    expect(longTab.get('.dou-tabs__close').attributes('title')).toBeUndefined()

    // truncated: native title appears and close button suppresses parent title
    longSize.scrollWidth = 320
    await longTab.trigger('pointerenter')
    expect(longTab.attributes('title')).toBe('上海前端基础设施架构评审与排期说明')
    expect(longTab.get('.dou-tabs__close').attributes('title')).toBe('')

    // label update clears stale title until measured again
    longTitle.value = '简短'
    await nextTick()
    expect(longTab.attributes('title')).toBeUndefined()

    // no longer truncated: stays without title
    longSize.scrollWidth = 160
    await longTab.trigger('pointerenter')
    expect(longTab.attributes('title')).toBeUndefined()

    wrapper.unmount()
  })

  it('detects truncated inner elements in custom #label slots and respects child title', async () => {
    const PinIcon = defineComponent({ setup: () => () => h('svg') })
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouTabs, null, () => [
            h(
              DouTabPanel,
              { value: 'custom', label: '完整标题' },
              {
                label: () => [
                  h('span', { class: 'custom-title' }, '自定义截断标题文字'),
                  h('span', { class: 'custom-badge' }, '3'),
                ],
              },
            ),
            h(
              DouTabPanel,
              { value: 'owned' },
              {
                label: () =>
                  h('span', { class: 'owned-title', title: '业务自定义提示' }, '自定义截断标题'),
              },
            ),
            h(DouTabPanel, {
              value: 'pinned-icon',
              label: '文件',
              icon: PinIcon,
              pinned: true,
            }),
          ]),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const [pinnedTab, customTab, ownedTab] = wrapper.findAll('[role="tab"]')
    const innerTitle = customTab!.get('.custom-title').element as HTMLElement
    Object.defineProperties(innerTitle, {
      clientWidth: { configurable: true, get: () => 100 },
      scrollWidth: { configurable: true, get: () => 240 },
    })
    await customTab!.trigger('pointerenter')
    // picks only the truncated element's text, not the sibling badge text
    expect(customTab!.attributes('title')).toBe('自定义截断标题文字')

    const ownedInner = ownedTab!.get('.owned-title').element as HTMLElement
    Object.defineProperties(ownedInner, {
      clientWidth: { configurable: true, get: () => 80 },
      scrollWidth: { configurable: true, get: () => 200 },
    })
    await ownedTab!.trigger('pointerenter')
    // leaves child's own title intact without duplicating it on the tab button
    expect(ownedTab!.attributes('title')).toBeUndefined()
    expect(ownedInner.getAttribute('title')).toBe('业务自定义提示')

    // icon-alone pinned tabs already use DouTooltip, so no native title is added
    await pinnedTab!.trigger('pointerenter')
    expect(pinnedTab!.attributes('title')).toBeUndefined()

    wrapper.unmount()
  })

  it('picks the deepest truncated element when custom #label wraps title and badge', async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouTabs, null, () => [
            h(
              DouTabPanel,
              { value: 'nested', label: '备用标题' },
              {
                label: () =>
                  h('span', { class: 'wrap' }, [
                    h('span', { class: 'leaf' }, '真正被截断的子标题'),
                    h('span', { class: 'count' }, '9'),
                  ]),
              },
            ),
          ]),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const tab = wrapper.get('[role="tab"]')
    const wrap = tab.get('.wrap').element as HTMLElement
    const leaf = tab.get('.leaf').element as HTMLElement
    Object.defineProperties(wrap, {
      clientWidth: { configurable: true, get: () => 100 },
      scrollWidth: { configurable: true, get: () => 180 },
    })
    Object.defineProperties(leaf, {
      clientWidth: { configurable: true, get: () => 80 },
      scrollWidth: { configurable: true, get: () => 160 },
    })
    await tab.trigger('pointerenter')
    expect(tab.attributes('title')).toBe('真正被截断的子标题')
    wrapper.unmount()
  })

  it('shows a native title on truncated items inside the overflow popover', async () => {
    const wrapper = manyTabs('t0')
    const list = wrapper.get('.dou-tabs__list').element as HTMLElement
    const { scrollTo } = layout(list)
    scrollTo(0)
    await nextTick()

    await wrapper.get('.dou-tabs__overflow').trigger('click')
    await nextTick()
    await nextTick()

    const popover = document.querySelector<HTMLElement>('.dou-tabs__overflow-popover')!
    const buttons = [...popover.querySelectorAll<HTMLButtonElement>('.dou-tabs__overflow-select')]
    const firstLabel = buttons[0]!.querySelector<HTMLElement>('.dou-tabs__overflow-label')!
    const secondLabel = buttons[1]!.querySelector<HTMLElement>('.dou-tabs__overflow-label')!
    Object.defineProperties(firstLabel, {
      clientWidth: { configurable: true, get: () => 120 },
      scrollWidth: { configurable: true, get: () => 120 },
    })
    Object.defineProperties(secondLabel, {
      clientWidth: { configurable: true, get: () => 120 },
      scrollWidth: { configurable: true, get: () => 260 },
    })

    buttons[0]!.dispatchEvent(new PointerEvent('pointerenter'))
    buttons[1]!.dispatchEvent(new PointerEvent('pointerenter'))
    expect(buttons[0]!.getAttribute('title')).toBeNull()
    expect(buttons[1]!.getAttribute('title')).toBe('标签 1')

    wrapper.unmount()
  })

  it('ignores ripple status dots in custom #label slots when resolving truncated titles', async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DouTabs, null, () => [
            h(
              DouTabPanel,
              { value: 'short', label: '核查度量前端灰度残留' },
              {
                label: () => [
                  h(DouStatusDot, { tone: 'primary', ripple: true, 'aria-hidden': 'true' }),
                  h('span', { class: 'pane-thread-title' }, '核查度量前端灰度残留'),
                ],
              },
            ),
            h(
              DouTabPanel,
              { value: 'long', label: '备用外部标题' },
              {
                label: () => [
                  h(DouStatusDot, { tone: 'primary', ripple: true, 'aria-hidden': 'true' }),
                  h('span', { class: 'pane-thread-title' }, '超长讨论串标题实际发生水平截断'),
                ],
              },
            ),
            h(
              DouTabPanel,
              { value: 'owned', label: '备用外部标题' },
              {
                label: () => [
                  h(DouStatusDot, { tone: 'primary', ripple: true, 'aria-hidden': 'true' }),
                  h(
                    'span',
                    { class: 'pane-thread-title', title: '业务自定义提示' },
                    '自带提示的截断标题',
                  ),
                ],
              },
            ),
            h(
              DouTabPanel,
              { value: 'dot-with-text', label: '备用状态标签' },
              {
                label: () => h(DouStatusDot, { tone: 'primary', ripple: true }, () => '运行中任务'),
              },
            ),
          ]),
      }),
      { attachTo: document.body },
    )
    await nextTick()

    const [shortTab, longTab, ownedTab, dotWithTextTab] = wrapper.findAll('[role="tab"]')

    // Simulate Chromium ripple pseudo-element enlarging status-dot scrollWidth (8 -> 14)
    for (const tab of [shortTab!, longTab!, ownedTab!]) {
      const dotWrap = tab.get('.dou-status-dot').element as HTMLElement
      const dot = tab.get('.dou-status-dot__dot').element as HTMLElement
      dotWrap.style.overflowX = 'visible'
      dot.style.overflowX = 'visible'
      setWidths(dotWrap, 8, 14)
      setWidths(dot, 8, 14)
    }

    const shortTitle = shortTab!.get('.pane-thread-title').element as HTMLElement
    shortTitle.style.overflow = 'hidden'
    setWidths(shortTitle, 130, 130)
    await shortTab!.trigger('pointerenter')
    expect(shortTab!.attributes('title')).toBeUndefined()

    const longTitle = longTab!.get('.pane-thread-title').element as HTMLElement
    longTitle.style.overflow = 'hidden'
    setWidths(longTitle, 120, 240)
    await longTab!.trigger('pointerenter')
    expect(longTab!.attributes('title')).toBe('超长讨论串标题实际发生水平截断')

    const ownedTitle = ownedTab!.get('.pane-thread-title').element as HTMLElement
    ownedTitle.style.overflow = 'hidden'
    setWidths(ownedTitle, 100, 220)
    await ownedTab!.trigger('pointerenter')
    expect(ownedTab!.attributes('title')).toBeUndefined()
    expect(ownedTitle.getAttribute('title')).toBe('业务自定义提示')

    // DouStatusDot with slotted text: outer container has overflow-x: visible, inner label clips
    const dotTextWrap = dotWithTextTab!.get('.dou-status-dot').element as HTMLElement
    const dotInner = dotWithTextTab!.get('.dou-status-dot__dot').element as HTMLElement
    const dotLabel = dotWithTextTab!.get('.dou-status-dot__label').element as HTMLElement
    dotTextWrap.style.overflowX = 'visible'
    dotInner.style.overflowX = 'visible'
    dotLabel.style.overflowX = 'clip'
    setWidths(dotTextWrap, 72, 78)
    setWidths(dotInner, 8, 14)
    setWidths(dotLabel, 56, 56)
    await dotWithTextTab!.trigger('pointerenter')
    expect(dotWithTextTab!.attributes('title')).toBeUndefined()

    setWidths(dotLabel, 56, 140)
    await dotWithTextTab!.trigger('pointerenter')
    expect(dotWithTextTab!.attributes('title')).toBe('运行中任务')

    wrapper.unmount()
  })
})
