import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
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
})
