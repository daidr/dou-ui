import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DouPopconfirm } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const panel = () => document.querySelector<HTMLElement>('.dou-popconfirm')
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.dou-popconfirm button')].find(
    (el) => el.textContent?.trim() === name,
  )!

const make = (props: Record<string, unknown> = {}) =>
  mount(DouPopconfirm, {
    props: { title: '删除这条记录？', description: '无法恢复', ...props },
    slots: { default: '<button class="trigger">删除</button>' },
    attachTo: document.body,
  })

describe('DouPopconfirm', () => {
  it('asks in an alert dialog and focuses cancel', async () => {
    const wrapper = make()
    await wrapper.get('.trigger').trigger('click')
    await nextTick()
    await nextTick()
    const el = panel()!
    expect(el.getAttribute('role')).toBe('alertdialog')
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)!.textContent).toBe(
      '删除这条记录？',
    )
    expect(el.textContent).toContain('无法恢复')
    expect(document.activeElement).toBe(button('取消'))

    button('取消').click()
    await nextTick()
    ;(document.activeElement as HTMLElement).blur()
    await wrapper.get('.trigger').trigger('click')
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(button('取消'))
    wrapper.unmount()
  })

  it('cancels', async () => {
    const onConfirm = vi.fn<() => void>()
    const wrapper = make({ onConfirm })
    await wrapper.get('.trigger').trigger('click')
    button('取消').click()
    await nextTick()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:open')!.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('returns focus to the trigger after either answer', async () => {
    const wrapper = make()
    const trigger = wrapper.get('.trigger')
    for (const name of ['取消', '确定']) {
      await trigger.trigger('click')
      await nextTick()
      await nextTick()
      button(name).focus()
      button(name).click()
      await flushPromises()
      expect(document.activeElement).toBe(trigger.element)
    }
    wrapper.unmount()
  })

  it('waits for an async confirm and stays open when it fails', async () => {
    let settle!: (ok: boolean) => void
    const onConfirm = vi.fn<() => Promise<void>>(
      () => new Promise<void>((resolve, reject) => (settle = (ok) => (ok ? resolve() : reject()))),
    )
    const wrapper = make({ onConfirm, tone: 'danger', confirmText: '删除' })
    await wrapper.get('.trigger').trigger('click')
    button('删除').click()
    await nextTick()
    expect(button('删除').getAttribute('aria-busy')).toBe('true')
    settle(false)
    await flushPromises()
    expect(wrapper.emitted('update:open')).toEqual([[true]])

    button('删除').click()
    settle(true)
    await flushPromises()
    expect(wrapper.emitted('update:open')!.at(-1)).toEqual([false])
    wrapper.unmount()
  })
})
