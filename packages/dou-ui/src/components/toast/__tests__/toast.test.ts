import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouConfigProvider, DouToastViewport, en, toast } from '../../../index'
import { setToastContext, toastState } from '../store'

const items = () => [...document.querySelectorAll<HTMLElement>('.dou-toast__item')]

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  toast.closeAll()
  vi.useRealTimers()
  setToastContext(null)
})

describe('toast', () => {
  it('shows a message and removes it after the duration', async () => {
    const onClose = vi.fn<() => void>()
    toast('已复制', { onClose })
    await nextTick()
    expect(items()).toHaveLength(1)
    expect(items()[0]!.getAttribute('role')).toBe('status')
    expect(items()[0]!.textContent).toContain('已复制')
    expect(document.querySelector('.dou-toast')?.getAttribute('aria-label')).toBe('通知')

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(toastState.items).toHaveLength(0)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has shortcuts for each tone, with an icon and an urgent role for danger', async () => {
    toast.success('已部署')
    toast.danger('构建失败')
    await nextTick()
    const [success, danger] = items()
    expect(success!.classList).toContain('dou-toast--success')
    expect(success!.querySelector('.dou-toast__icon')).not.toBeNull()
    expect(danger!.getAttribute('role')).toBe('alert')
  })

  it('pauses while hovered and resumes with the time left', async () => {
    toast('稍等', { duration: 1000 })
    await nextTick()
    vi.advanceTimersByTime(600)
    items()[0]!.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(5000)
    expect(toastState.items).toHaveLength(1)
    items()[0]!.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(399)
    expect(toastState.items).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toastState.items).toHaveLength(0)
  })

  it('stays with duration 0 and closes from its button or handle', async () => {
    const handle = toast({ message: '断开', duration: 0, closable: true })
    toast('另一条', { duration: 0 })
    await nextTick()
    vi.advanceTimersByTime(60_000)
    expect(toastState.items).toHaveLength(2)
    document.querySelector<HTMLButtonElement>('.dou-toast__close')!.click()
    expect(toastState.items.map((item) => item.message)).toEqual(['另一条'])
    handle.close()
    toast.close(toastState.items[0]!.id)
    expect(toastState.items).toHaveLength(0)
  })

  it('runs an action and then closes', async () => {
    const undo = vi.fn<() => void>()
    toast({ message: '已删除', action: { label: '撤销', onClick: undo } })
    await nextTick()
    const action = document.querySelector<HTMLButtonElement>('.dou-toast__action')!
    expect(action.textContent?.trim()).toBe('撤销')
    action.click()
    expect(undo).toHaveBeenCalledOnce()
    expect(toastState.items).toHaveLength(0)
  })

  it('groups toasts by placement and keeps at most five in each', async () => {
    for (let index = 0; index < 7; index++) toast(`第 ${index} 条`, { placement: 'bottom-right' })
    toast('顶部')
    await nextTick()
    await nextTick()
    expect(document.querySelectorAll('.dou-toast--bottom-right .dou-toast__item')).toHaveLength(5)
    expect(document.querySelectorAll('.dou-toast--top .dou-toast__item')).toHaveLength(1)
    expect(toastState.items[0]!.message).toBe('第 2 条')
  })

  it('shows in the latest viewport, with the config around it', async () => {
    const wrapper = mount(
      { render: () => h(DouConfigProvider, { locale: en }, () => h(DouToastViewport)) },
      { attachTo: document.body },
    )
    toast('Saved', { closable: true })
    await flushPromises()
    expect(document.querySelector('.dou-toast__close')?.getAttribute('aria-label')).toBe('Close')
    wrapper.unmount()
  })
})
