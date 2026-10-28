import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouButton, DouConfigProvider, DouTooltip } from '../../../index'

const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"]')

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('DouTooltip', () => {
  it('shows after the delay on hover and describes the trigger', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: '复制链接' },
      slots: { default: () => h(DouButton, null, () => '复制') },
      attachTo: document.body,
    })
    const button = wrapper.get('button')
    expect(tooltip()).toBeNull()

    await button.trigger('mouseenter')
    vi.advanceTimersByTime(199)
    await nextTick()
    expect(tooltip()).toBeNull()
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(tooltip()?.textContent).toBe('复制链接')
    expect(button.attributes('aria-describedby')).toBe(tooltip()?.id)

    await button.trigger('mouseleave')
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(tooltip()?.style.display).toBe('none')
    expect(button.attributes('aria-describedby')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows on focus at once and hides on Escape', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: '提示' },
      slots: { default: () => h('button', '触发') },
      attachTo: document.body,
    })
    await wrapper.get('button').trigger('focusin')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([true])
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('wraps plain text in a span and stays silent when disabled', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: '提示', disabled: true },
      slots: { default: '文字' },
      attachTo: document.body,
    })
    expect(wrapper.find('span').text()).toBe('文字')
    await wrapper.get('span').trigger('focusin')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })

  it('stacks above the configured z-index and carries the theme', async () => {
    const wrapper = mount(
      {
        render: () =>
          h('div', { 'data-dou-theme': 'dark' }, [
            h(DouConfigProvider, { zIndex: 5000 }, () =>
              h(DouTooltip, { content: '提示', open: true }, () => h('button', '触发')),
            ),
          ]),
      },
      { attachTo: document.body },
    )
    await nextTick()
    await nextTick()
    const panel = tooltip()!
    expect(Number(panel.style.zIndex)).toBeGreaterThan(5000)
    expect(panel.dataset.douTheme).toBe('dark')
    expect(panel.closest('[data-v-app]')).toBeNull()
    wrapper.unmount()
  })
})
