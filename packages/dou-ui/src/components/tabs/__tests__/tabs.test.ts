import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    await nextTick()
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

/** Give the tab list a layout: 300px wide, 900px of tabs, each tab 100px. */
function layout(list: HTMLElement) {
  let left = 0
  Object.defineProperties(list, {
    clientWidth: { configurable: true, get: () => 300 },
    scrollWidth: { configurable: true, get: () => 900 },
    scrollLeft: {
      configurable: true,
      get: () => left,
      set: (v: number) => {
        left = v
      },
    },
  })
  const calls: { to: number[]; by: number[] } = { to: [], by: [] }
  list.scrollTo = ((options: ScrollToOptions) => {
    calls.to.push(options.left!)
    left = options.left!
  }) as typeof list.scrollTo
  list.scrollBy = ((options: ScrollToOptions) => {
    calls.by.push(options.left!)
  }) as typeof list.scrollBy
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
    scrollTo(value: number) {
      left = value
      list.dispatchEvent(new Event('scroll'))
    },
  }
}

const manyTabs = (value: string) =>
  mount(DouTabs, {
    props: { modelValue: value },
    slots: {
      default: () =>
        Array.from({ length: 9 }, (_, index) =>
          h(DouTabPanel, { value: `t${index}`, label: `标签 ${index}` }, () => `内容 ${index}`),
        ),
    },
    attachTo: document.body,
  })

describe('DouTabs overflow', () => {
  afterEach(() => {
    const proto = HTMLButtonElement.prototype as unknown as Record<string, unknown>
    delete proto.offsetLeft
    delete proto.offsetWidth
  })

  it('fades the edges and shows arrows on the side with more tabs', async () => {
    const wrapper = manyTabs('t0')
    const list = wrapper.get('[role="tablist"]').element as HTMLElement
    const { calls, scrollTo } = layout(list)
    scrollTo(0)
    await nextTick()
    expect(list.classList).toContain('is-fade-end')
    expect(list.classList).not.toContain('is-fade-start')
    const [prev, next] = wrapper.findAll('.dou-tabs__scroll')
    expect(prev!.attributes('disabled')).toBeDefined()
    expect(prev!.attributes('tabindex')).toBe('-1')
    await next!.trigger('click')
    expect(calls.by).toEqual([240])

    scrollTo(600)
    await nextTick()
    expect(list.classList).toContain('is-fade-start')
    expect(list.classList).not.toContain('is-fade-end')
    expect(wrapper.findAll('.dou-tabs__scroll')[1]!.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('scrolls the selected tab into view, clear of the faded edge', async () => {
    const wrapper = manyTabs('t0')
    const list = wrapper.get('[role="tablist"]').element as HTMLElement
    const { calls } = layout(list)
    await wrapper.setProps({ modelValue: 't6' })
    await nextTick()
    await nextTick()
    // tab 6 ends at 700: 700 + 32 - 300
    expect(calls.to.at(-1)).toBe(432)
    wrapper.unmount()
  })

  it('has no arrows in a row too narrow to show a tab beside them', async () => {
    const wrapper = manyTabs('t0')
    const header = wrapper.get('.dou-tabs__header').element as HTMLElement
    Object.defineProperty(header, 'clientWidth', { configurable: true, value: 120 })
    const list = wrapper.get('[role="tablist"]').element as HTMLElement
    const { scrollTo } = layout(list)
    scrollTo(0)
    await nextTick()
    // the row still scrolls and fades, by swiping, the wheel or the arrow keys
    expect(list.classList).toContain('is-fade-end')
    expect(wrapper.find('.dou-tabs__scroll').exists()).toBe(false)
    wrapper.unmount()
  })

  it('has no arrows when the tabs fit', async () => {
    const wrapper = make()
    await nextTick()
    expect(wrapper.find('.dou-tabs__scroll').exists()).toBe(false)
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
    offset.mockRestore()
    vi.unstubAllGlobals()
  })
})
