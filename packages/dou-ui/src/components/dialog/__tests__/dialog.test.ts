import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouConfigProvider, DouDialog, en } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const settle = async () => {
  await nextTick()
  await nextTick()
}

function withModel(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouDialog, {
    props: {
      open: false,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      title: '邀请成员',
      ...props,
    },
    slots: {
      default: () => h('input', { id: 'email' }),
      footer: ({ close }: { close: () => void }) => h('button', { id: 'cancel', onClick: close }),
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('DouDialog', () => {
  it('renders nothing until first opened', () => {
    withModel()
    expect(dialog()).toBeNull()
  })

  it('is a labelled modal dialog that takes focus and locks the page', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const wrapper = withModel()
    await wrapper.setProps({ open: true })
    await settle()

    const panel = dialog()!
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(panel.getAttribute('aria-labelledby')!)?.textContent).toBe(
      '邀请成员',
    )
    expect(document.activeElement).toBe(panel)
    expect(document.body.style.overflow).toBe('hidden')
    expect(wrapper.emitted('open')).toHaveLength(1)

    await wrapper.setProps({ open: false })
    await settle()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(opener)
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('closes from the close button, Escape and the mask', async () => {
    const wrapper = withModel({ open: true })
    await settle()
    const close = document.querySelector<HTMLButtonElement>('.dou-dialog__close')!
    expect(close.getAttribute('aria-label')).toBe('关闭')
    close.click()
    await settle()
    expect(wrapper.props('open')).toBe(false)

    await wrapper.setProps({ open: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await settle()
    expect(wrapper.props('open')).toBe(false)

    await wrapper.setProps({ open: true })
    const mask = document.querySelector<HTMLElement>('.dou-dialog')!
    mask.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    mask.click()
    await settle()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('ignores a press that starts inside the panel and ends on the mask', async () => {
    const wrapper = withModel({ open: true })
    await settle()
    dialog()!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.querySelector<HTMLElement>('.dou-dialog')!.click()
    await settle()
    expect(wrapper.props('open')).toBe(true)
    wrapper.unmount()
  })

  it('respects closeOnEscape, closeOnMask and beforeClose', async () => {
    let allow = false
    const wrapper = withModel({
      open: true,
      closeOnEscape: false,
      closeOnMask: false,
      beforeClose: () => allow,
    })
    await settle()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    const mask = document.querySelector<HTMLElement>('.dou-dialog')!
    mask.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    mask.click()
    document.getElementById('cancel')!.click()
    await settle()
    expect(wrapper.props('open')).toBe(true)

    allow = true
    document.getElementById('cancel')!.click()
    await settle()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('uses the locale for the close label', async () => {
    const wrapper = mount(
      {
        render: () =>
          h(DouConfigProvider, { locale: en }, () => h(DouDialog, { open: true, title: 'Hi' })),
      },
      { attachTo: document.body },
    )
    await settle()
    expect(document.querySelector('.dou-dialog__close')?.getAttribute('aria-label')).toBe('Close')
    wrapper.unmount()
  })
})
