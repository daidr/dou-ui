import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouPopover } from '../../../index'

const panel = () => document.querySelector<HTMLElement>('.dou-popover')

afterEach(() => {
  document.body.innerHTML = ''
})

function withModel(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouPopover, {
    props: {
      open: false,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      title: '删除分支',
      ...props,
    },
    slots: {
      default: () => h('button', { id: 'trigger' }, '打开'),
      content: ({ close }: { close: () => void }) =>
        h('button', { id: 'inside', onClick: close }, '取消'),
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('DouPopover', () => {
  it('toggles on click and is a labelled dialog', async () => {
    const wrapper = withModel()
    const trigger = wrapper.get('#trigger')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const dialog = panel()!
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(trigger.attributes('aria-controls')).toBe(dialog.id)
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)
    expect(title?.textContent).toBe('删除分支')

    await trigger.trigger('click')
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('closes on a press outside, but not inside', async () => {
    const wrapper = withModel({ open: true })
    await nextTick()
    document
      .getElementById('inside')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
    expect(wrapper.props('open')).toBe(true)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('lets the content close it and returns focus on Escape', async () => {
    const wrapper = withModel({ open: true })
    await nextTick()
    document.getElementById('inside')!.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    expect(document.activeElement?.id).toBe('trigger')

    await wrapper.setProps({ open: true })
    document.getElementById('inside')!.click()
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('returns focus to the trigger when the content closes it', async () => {
    const wrapper = withModel({ open: true })
    await nextTick()
    const inside = document.getElementById('inside')!
    inside.focus()
    inside.click()
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    expect(document.activeElement?.id).toBe('trigger')

    // closing from outside the panel leaves focus where it is
    await wrapper.setProps({ open: true })
    const other = document.body.appendChild(document.createElement('button'))
    other.focus()
    ;(wrapper.vm as unknown as { close: () => void }).close()
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    expect(document.activeElement).toBe(other)
    wrapper.unmount()
  })

  it('steps into the panel with Tab from the trigger', async () => {
    const wrapper = withModel({ open: true })
    await nextTick()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    wrapper.get('#trigger').element.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('inside')
    wrapper.unmount()
  })

  it('closes when Tab leaves the trigger and the panel has nothing to focus', async () => {
    const wrapper = mount(DouPopover, {
      props: {
        open: true,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
        content: '只有文字',
      },
      slots: { default: () => h('button', { id: 'trigger' }, '打开') },
      attachTo: document.body,
    })
    await nextTick()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    wrapper.get('#trigger').element.dispatchEvent(tab)
    // the browser moves the focus on as usual
    expect(tab.defaultPrevented).toBe(false)
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('closes when Shift+Tab leaves the trigger', async () => {
    const wrapper = withModel({ open: true })
    await nextTick()
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    wrapper.get('#trigger').element.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('opens a hover card on a tap or Enter and marks it expanded then', async () => {
    const wrapper = withModel({ trigger: 'hover' })
    const trigger = wrapper.get('#trigger')
    expect(trigger.attributes('aria-expanded')).toBeUndefined()
    await trigger.trigger('pointerdown', { pointerType: 'touch' })
    await trigger.trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(true)
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('pointerdown', { pointerType: 'touch' })
    await trigger.trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(false)
    // Enter or Space
    await trigger.trigger('click', { detail: 0 })
    expect(wrapper.props('open')).toBe(true)
    expect(trigger.attributes('aria-expanded')).toBe('true')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('skips touch and pen taps on a hover card when openOnTap is false, keeping hover, keyboard and primary click', async () => {
    vi.useFakeTimers()
    try {
      const clicked = vi.fn<() => void>()
      const wrapper = mount(DouPopover, {
        props: {
          open: false,
          'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
          trigger: 'hover' as const,
          openOnTap: false,
          showDelay: 50,
          hideDelay: 50,
          content: '预览信息',
        },
        slots: {
          default: () => h('button', { id: 'trigger', onClick: clicked }, '切换项目'),
        },
        attachTo: document.body,
      })
      const trigger = wrapper.get('#trigger')

      // touch tap runs the trigger's own click without opening the popover
      await trigger.trigger('pointerenter', { pointerType: 'touch' })
      await trigger.trigger('pointerdown', { pointerType: 'touch' })
      await trigger.trigger('click', { detail: 1 })
      vi.advanceTimersByTime(100)
      await nextTick()
      expect(clicked).toHaveBeenCalledTimes(1)
      expect(wrapper.props('open')).toBe(false)
      expect(trigger.attributes('aria-expanded')).toBeUndefined()

      // pen tap also stays closed
      await trigger.trigger('pointerdown', { pointerType: 'pen' })
      await trigger.trigger('click', { detail: 1 })
      expect(clicked).toHaveBeenCalledTimes(2)
      expect(wrapper.props('open')).toBe(false)

      // mouse hover still opens and closes as usual
      await trigger.trigger('pointerenter', { pointerType: 'mouse' })
      vi.advanceTimersByTime(50)
      await nextTick()
      expect(wrapper.props('open')).toBe(true)

      await trigger.trigger('pointerleave', { pointerType: 'mouse' })
      vi.advanceTimersByTime(50)
      await nextTick()
      expect(wrapper.props('open')).toBe(false)

      // keyboard Enter/Space still toggles the hover card
      await trigger.trigger('click', { detail: 0 })
      expect(wrapper.props('open')).toBe(true)
      expect(trigger.attributes('aria-expanded')).toBe('true')
      await trigger.trigger('click', { detail: 0 })
      expect(wrapper.props('open')).toBe(false)

      // re-enabling openOnTap reactively restores tap-to-open
      await wrapper.setProps({ openOnTap: true })
      await trigger.trigger('pointerdown', { pointerType: 'touch' })
      await trigger.trigger('click', { detail: 1 })
      expect(wrapper.props('open')).toBe(true)

      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not block link navigation on touch when openOnTap is false', async () => {
    const wrapper = mount(DouPopover, {
      props: {
        open: false,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
        trigger: 'hover' as const,
        openOnTap: false,
        content: '预览信息',
      },
      slots: {
        default: () => h('a', { id: 'link', href: '#project' }, '项目'),
      },
      attachTo: document.body,
    })
    const link = wrapper.get('#link').element
    link.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
    const click = new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true })
    link.dispatchEvent(click)
    await nextTick()
    expect(click.defaultPrevented).toBe(false)
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('still toggles on touch tap when trigger is click even if openOnTap is false', async () => {
    const wrapper = withModel({ trigger: 'click', openOnTap: false })
    const trigger = wrapper.get('#trigger')
    await trigger.trigger('pointerdown', { pointerType: 'touch' })
    await trigger.trigger('click', { detail: 1 })
    expect(wrapper.props('open')).toBe(true)
    wrapper.unmount()
  })

  it('applies maxHeight as --dou-popover-max-height and sets --dou-floating-available', async () => {
    const wrapper = withModel({ open: true, maxHeight: 240 })
    await nextTick()
    const dialog = panel()!
    expect(dialog.style.getPropertyValue('--dou-popover-max-height')).toBe('240px')
    expect(dialog.style.getPropertyValue('--dou-floating-available')).toMatch(/^\d+px$/)

    await wrapper.setProps({ maxHeight: '20rem' })
    await nextTick()
    expect(dialog.style.getPropertyValue('--dou-popover-max-height')).toBe('20rem')

    await wrapper.setProps({ maxHeight: undefined })
    await nextTick()
    expect(dialog.style.getPropertyValue('--dou-popover-max-height')).toBe('')
    wrapper.unmount()
  })

  it('syncs --dou-popover-max-width with explicit width while keeping default and intrinsic widths intact', async () => {
    const wrapper = withModel({ open: true })
    await nextTick()
    const dialog = panel()!
    // Default (no width prop): leave CSS defaults (--dou-popover-max-width: 360px) untouched.
    expect(dialog.style.width).toBe('')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('')

    // Explicit width > 360px updates both width and --dou-popover-max-width.
    await wrapper.setProps({ width: 560 })
    await nextTick()
    expect(dialog.style.width).toBe('560px')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('560px')

    // CSS lengths and percentages are forwarded to both properties.
    await wrapper.setProps({ width: '36rem' })
    await nextTick()
    expect(dialog.style.width).toBe('36rem')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('36rem')

    await wrapper.setProps({ width: '50%' })
    await nextTick()
    expect(dialog.style.width).toBe('50%')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('50%')

    // Explicit width <= 360px also stays in sync.
    await wrapper.setProps({ width: 260 })
    await nextTick()
    expect(dialog.style.width).toBe('260px')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('260px')

    // Intrinsic keywords are not valid arguments to CSS min() and must not override --dou-popover-max-width.
    for (const keyword of ['auto', 'max-content', 'fit-content']) {
      await wrapper.setProps({ width: keyword })
      await nextTick()
      expect(dialog.style.width).toBe(keyword)
      expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('')
    }

    // Empty or cleared width restores CSS defaults cleanly.
    await wrapper.setProps({ width: '' })
    await nextTick()
    expect(dialog.style.width).toBe('')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('')

    await wrapper.setProps({ width: 520 })
    await nextTick()
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('520px')

    await wrapper.setProps({ width: undefined })
    await nextTick()
    expect(dialog.style.width).toBe('')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('')
    wrapper.unmount()
  })

  it('lets an explicit inline --dou-popover-max-width override the width-derived cap', async () => {
    const wrapper = mount(DouPopover, {
      props: { open: true, width: 560, content: '宽弹层' },
      attrs: { style: '--dou-popover-max-width: 420px' },
      slots: { default: () => h('button', { id: 'trigger' }, '打开') },
      attachTo: document.body,
    })
    await nextTick()
    const dialog = panel()!
    expect(dialog.style.width).toBe('560px')
    expect(dialog.style.getPropertyValue('--dou-popover-max-width')).toBe('420px')
    wrapper.unmount()
  })
})
