import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { DouTabPanel, DouTabs } from '../../../index'

const Icon = defineComponent({ setup: () => () => h('svg', { class: 'probe-icon' }) })

const panels = (withIcons = true) => [
  h(DouTabPanel, { value: 'profile', label: '个人资料', icon: withIcons ? Icon : undefined }),
  h(DouTabPanel, { value: 'security', label: '账号安全', icon: withIcons ? Icon : undefined }),
]

describe('DouTabs height', () => {
  it('takes a fixed height in px or as written', async () => {
    const wrapper = mount(DouTabs, { props: { height: 320 }, slots: { default: () => panels() } })
    expect(wrapper.classes()).toContain('is-fixed')
    expect((wrapper.element as HTMLElement).style.height).toBe('320px')
    await wrapper.setProps({ height: '100%' })
    expect((wrapper.element as HTMLElement).style.height).toBe('100%')
    await wrapper.setProps({ height: undefined })
    expect(wrapper.classes()).not.toContain('is-fixed')
    expect((wrapper.element as HTMLElement).style.height).toBe('')
  })

  it('fades a column of tabs that does not fit and keeps the selected one in view', async () => {
    const wrapper = mount(DouTabs, {
      props: { placement: 'start', height: 200, modelValue: 't0' },
      slots: {
        default: () =>
          Array.from({ length: 9 }, (_, index) =>
            h(DouTabPanel, { value: `t${index}`, label: `标签 ${index}` }),
          ),
      },
      attachTo: document.body,
    })
    const list = wrapper.get('[role="tablist"]').element as HTMLElement
    let top = 0
    const to: number[] = []
    Object.defineProperties(list, {
      clientHeight: { configurable: true, get: () => 200 },
      scrollHeight: { configurable: true, get: () => 600 },
      scrollTop: { configurable: true, get: () => top },
    })
    list.scrollTo = ((options: ScrollToOptions) => {
      to.push(options.top!)
      top = options.top!
    }) as typeof list.scrollTo
    const proto = HTMLButtonElement.prototype as unknown as Record<string, unknown>
    Object.defineProperties(proto, {
      offsetTop: {
        configurable: true,
        get(this: HTMLElement) {
          const index = /标签 (\d)/.exec(this.textContent ?? '')?.[1]
          return index === undefined ? 0 : Number(index) * 40
        },
      },
      offsetHeight: { configurable: true, get: () => 40 },
    })
    try {
      list.dispatchEvent(new Event('scroll'))
      await nextTick()
      expect(list.classList).toContain('is-fade-end')
      expect(list.classList).not.toContain('is-fade-start')
      // a column scrolls with the wheel; it has no arrows
      expect(wrapper.find('.dou-tabs__scroll').exists()).toBe(false)

      await wrapper.setProps({ modelValue: 't7' })
      await nextTick()
      await nextTick()
      // tab 7 ends at 320: 320 + 32 - 200
      expect(to.at(-1)).toBe(152)
      list.dispatchEvent(new Event('scroll'))
      await nextTick()
      expect(list.classList).toContain('is-fade-start')
      expect(list.classList).toContain('is-fade-end')
    } finally {
      delete proto.offsetTop
      delete proto.offsetHeight
      wrapper.unmount()
    }
  })
})

describe('DouTabs icons', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows a panel icon before its label', async () => {
    const wrapper = mount(DouTabs, { slots: { default: () => panels() } })
    await nextTick()
    const tab = wrapper.get('[role="tab"]')
    expect(tab.find('.probe-icon').classes()).toContain('dou-tabs__icon')
    expect(tab.find('.probe-icon').attributes('aria-hidden')).toBe('true')
    expect(tab.text()).toBe('个人资料')
    expect(tab.attributes('aria-label')).toBeUndefined()
  })

  it('with iconOnly, shows the icon alone and names the tab by its label', async () => {
    const wrapper = mount(DouTabs, {
      props: { iconOnly: true, placement: 'start' },
      slots: { default: () => panels() },
      attachTo: document.body,
    })
    await nextTick()
    const tab = wrapper.get('[role="tab"]')
    expect(tab.classes()).toContain('is-icon-alone')
    expect(tab.find('.dou-tabs__label').exists()).toBe(false)
    expect(tab.attributes('aria-label')).toBe('个人资料')

    await tab.trigger('focusin')
    vi.advanceTimersByTime(200)
    await nextTick()
    const tip = document.querySelector<HTMLElement>('[role="tooltip"]')
    expect(tip?.textContent).toBe('个人资料')
    expect(tip?.dataset.placement).toBe('right')
    wrapper.unmount()
  })

  it('with iconOnly, keeps the close button of a closable tab', async () => {
    const wrapper = mount(DouTabs, {
      props: { iconOnly: true, closable: true },
      slots: { default: () => panels() },
    })
    await nextTick()
    const tab = wrapper.get('[role="tab"]')
    // the theme widens a closable icon tab for the button
    expect(tab.classes()).toEqual(expect.arrayContaining(['is-icon-alone', 'is-closable']))
    expect(tab.find('.dou-tabs__close').exists()).toBe(true)
    await tab.trigger('keydown', { key: 'Delete' })
    expect(wrapper.emitted('remove')).toEqual([['profile']])
  })

  it('keeps the text of a panel without an icon, and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouTabs, {
      props: { iconOnly: true },
      slots: { default: () => panels(false) },
    })
    await nextTick()
    const tab = wrapper.get('[role="tab"]')
    expect(tab.text()).toBe('个人资料')
    expect(tab.attributes('aria-label')).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`iconOnly` needs an `icon`'))
    warn.mockRestore()
  })
})
