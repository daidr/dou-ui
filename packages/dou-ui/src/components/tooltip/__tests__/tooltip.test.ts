import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouButton, DouConfigProvider, DouTooltip } from '../../../index'

const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"]')

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('DouTooltip', () => {
  it('shows one tooltip at a time', async () => {
    const wrapper = mount(
      {
        render: () => [
          h(DouTooltip, { content: '甲' }, () => h('button', { id: 'a' }, 'a')),
          h(DouTooltip, { content: '乙' }, () => h('button', { id: 'b' }, 'b')),
        ],
      },
      { attachTo: document.body },
    )
    const [first, second] = wrapper.findAllComponents(DouTooltip)
    await wrapper.get('#a').trigger('focusin')
    expect(first!.emitted('update:open')?.at(-1)).toEqual([true])

    await wrapper.get('#b').trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(second!.emitted('update:open')?.at(-1)).toEqual([true])
    expect(first!.emitted('update:open')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('leaves tooltips opened through open alone', async () => {
    const a = ref(true)
    const b = ref(true)
    const wrapper = mount(
      {
        render: () => [
          h(
            DouTooltip,
            { content: '甲', open: a.value, 'onUpdate:open': (v: boolean) => (a.value = v) },
            () => h('button', { id: 'a' }, 'a'),
          ),
          h(
            DouTooltip,
            { content: '乙', open: b.value, 'onUpdate:open': (v: boolean) => (b.value = v) },
            () => h('button', { id: 'b' }, 'b'),
          ),
          h(DouTooltip, { content: '丙' }, () => h('button', { id: 'c' }, 'c')),
        ],
      },
      { attachTo: document.body },
    )
    await nextTick()
    expect([a.value, b.value]).toEqual([true, true])

    // hovering another tooltip does not close them, and they do not close it
    await wrapper.get('#c').trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(200)
    await nextTick()
    expect([a.value, b.value]).toEqual([true, true])
    expect(wrapper.findAllComponents(DouTooltip)[2]!.emitted('update:open')?.at(-1)).toEqual([true])
    wrapper.unmount()
  })

  it('shows after the delay on hover and describes the trigger', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: '复制链接' },
      slots: { default: () => h(DouButton, null, () => '复制') },
      attachTo: document.body,
    })
    const button = wrapper.get('button')
    expect(tooltip()).toBeNull()

    await button.trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(199)
    await nextTick()
    expect(tooltip()).toBeNull()
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(tooltip()?.textContent).toBe('复制链接')
    expect(button.attributes('aria-describedby')).toBe(tooltip()?.id)

    await button.trigger('pointerleave', { pointerType: 'mouse' })
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

  it('does not show on the focus a press gives, so it cannot take the release', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: '提示' },
      slots: { default: () => h('button', '触发') },
      attachTo: document.body,
    })
    const button = wrapper.get('button')
    await button.trigger('pointerdown', { pointerType: 'mouse' })
    await button.trigger('focusin')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    // focus later, e.g. from the keyboard, shows it again
    vi.advanceTimersByTime(0)
    await button.trigger('focusout')
    await button.trigger('focusin')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([true])
    wrapper.unmount()
  })

  it('stays away on touch, where a tap would leave it up', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: '提示' },
      slots: { default: () => h('button', '触发') },
      attachTo: document.body,
    })
    const button = wrapper.get('button')
    await button.trigger('pointerenter', { pointerType: 'touch' })
    await button.trigger('pointerdown', { pointerType: 'touch' })
    await button.trigger('pointerleave', { pointerType: 'touch' })
    await button.trigger('mouseenter')
    await button.trigger('focusin')
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    // Once it is left, a mouse or the keyboard brings the tip back.
    await button.trigger('focusout')
    await button.trigger('focusin')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([true])
    wrapper.unmount()
  })

  it('shows a shortcut after the text and gives it to the trigger', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: '撤销', shortcut: 'mod+z', open: true },
      slots: { default: () => h('button', { 'aria-label': '撤销' }) },
      attachTo: document.body,
    })
    await nextTick()
    expect(tooltip()?.querySelector('.dou-kbd')?.textContent).toBe('CtrlZ')
    expect(tooltip()?.textContent).toBe('撤销CtrlZ')
    expect(wrapper.get('button').attributes('aria-keyshortcuts')).toBe('Control+Z')
    await wrapper.setProps({ shortcut: undefined })
    expect(tooltip()?.querySelector('.dou-kbd')).toBeNull()
    expect(wrapper.get('button').attributes('aria-keyshortcuts')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps the shortcut with the content slot', async () => {
    mount(DouTooltip, {
      props: { shortcut: 'mod+s', open: true },
      slots: { default: () => h('button', '保存'), content: () => h('b', '保存草稿') },
      attachTo: document.body,
    })
    await nextTick()
    expect(tooltip()?.querySelector('b')?.textContent).toBe('保存草稿')
    expect(tooltip()?.querySelector('.dou-kbd')?.textContent).toBe('CtrlS')
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
