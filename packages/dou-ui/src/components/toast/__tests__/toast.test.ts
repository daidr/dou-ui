import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouConfigProvider, DouToastViewport, en, toast } from '../../../index'
import { setInstalledAppContext } from '../../../utils/app-context'
import { toastState } from '../store'

// Toasts on their way out stay until their transition ends.
const items = () => [
  ...document.querySelectorAll<HTMLElement>('.dou-toast__item:not(.dou-toast-leave-active)'),
]
const list = () => document.querySelector<HTMLElement>('.dou-toast__list')!
const pointer = (type: string, pointerType = 'mouse') =>
  Object.assign(new Event(type, { bubbles: type === 'pointerdown' }), { pointerType })

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  toast.closeAll()
  vi.runAllTimers()
  vi.useRealTimers()
  setInstalledAppContext(null)
})

describe('toast', () => {
  it('keeps a loading toast until it is updated, then counts down again', async () => {
    const handle = toast.loading('保存中…')
    await nextTick()
    expect(items()[0]!.querySelector('.dou-spinner')).not.toBeNull()
    expect(items()[0]!.getAttribute('aria-busy')).toBe('true')
    vi.advanceTimersByTime(60_000)
    expect(toastState.items).toHaveLength(1)

    handle.update({ message: '已保存', tone: 'success' })
    await nextTick()
    expect(items()[0]!.textContent).toContain('已保存')
    expect(items()[0]!.classList).toContain('dou-toast--success')
    expect(items()[0]!.querySelector('.dou-spinner')).toBeNull()
    vi.advanceTimersByTime(2999)
    expect(toastState.items).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toastState.items).toHaveLength(0)
  })

  it('restarts the countdown when a toast is updated by id', async () => {
    const { id } = toast('第一步', { duration: 1000 })
    await nextTick()
    vi.advanceTimersByTime(800)
    toast.update(id, '第二步')
    await nextTick()
    vi.advanceTimersByTime(800)
    expect(toastState.items[0]!.message).toBe('第二步')
    vi.advanceTimersByTime(200)
    expect(toastState.items).toHaveLength(0)
  })

  it('follows a promise from loading to success', async () => {
    let resolve!: (value: number) => void
    const task = new Promise<number>((r) => (resolve = r))
    const returned = toast.promise(task, {
      loading: '保存中…',
      success: (count) => `已保存 ${count} 处`,
      error: '保存失败',
    })
    expect(returned).toBe(task)
    await nextTick()
    expect(toastState.items[0]).toMatchObject({ message: '保存中…', loading: true })
    resolve(3)
    await flushPromises()
    expect(toastState.items[0]).toMatchObject({
      message: '已保存 3 处',
      tone: 'success',
      loading: false,
      duration: 3000,
    })
  })

  it('turns a failed promise into a danger toast', async () => {
    const returned = toast.promise(() => Promise.reject(new Error('超时')), {
      loading: '发布中…',
      success: '已发布',
      error: (error) => ({ title: '发布失败', message: (error as Error).message }),
    })
    await expect(returned).rejects.toThrow('超时')
    await flushPromises()
    expect(toastState.items[0]).toMatchObject({
      title: '发布失败',
      message: '超时',
      tone: 'danger',
      loading: false,
    })
  })
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
    list().dispatchEvent(pointer('pointerenter'))
    await nextTick()
    vi.advanceTimersByTime(5000)
    expect(toastState.items).toHaveLength(1)
    list().dispatchEvent(pointer('pointerleave'))
    await nextTick()
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
    expect(
      document.querySelectorAll(
        '.dou-toast--bottom-right .dou-toast__item:not(.dou-toast-leave-active)',
      ),
    ).toHaveLength(5)
    expect(
      document.querySelectorAll('.dou-toast--top .dou-toast__item:not(.dou-toast-leave-active)'),
    ).toHaveLength(1)
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

const offsets = () => items().map((el) => el.style.getPropertyValue('--dou-toast-offset'))
const show = async (count: number) => {
  for (let index = 0; index < count; index++) toast(`第 ${index} 条`, { duration: 1000 })
  await nextTick()
  await nextTick()
}

describe('toast stack', () => {
  // jsdom lays nothing out: each toast is 50px tall, 48 inside a 1px border.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('dou-toast__body') ? 48 : 50
    })
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(48)
  })
  afterEach(() => vi.restoreAllMocks())

  it('lays toasts on top of each other, newest in front, three showing', async () => {
    await show(4)
    // oldest first in the page, so the newest is last
    expect(offsets()).toEqual(['24px', '24px', '12px', '0px'])
    expect(items().map((el) => el.style.getPropertyValue('--dou-toast-scale'))).toEqual([
      '0.85',
      '0.9',
      '0.95',
      '1',
    ])
    expect(items().map((el) => el.classList.contains('is-behind'))).toEqual([
      true,
      true,
      true,
      false,
    ])
    expect(items()[0]!.classList).toContain('is-hidden')
    expect(items().every((el) => el.style.height === '50px')).toBe(true)
    expect(list().style.height).toBe('74px')
    expect(list().classList).not.toContain('is-expanded')
  })

  it('spreads out and waits while the mouse is over it', async () => {
    await show(3)
    list().dispatchEvent(pointer('pointerenter'))
    await nextTick()
    expect(list().classList).toContain('is-expanded')
    expect(offsets()).toEqual(['116px', '58px', '0px'])
    expect(list().style.height).toBe('166px')
    vi.advanceTimersByTime(5000)
    expect(toastState.items).toHaveLength(3)

    list().dispatchEvent(pointer('pointerleave'))
    await nextTick()
    expect(offsets()).toEqual(['24px', '12px', '0px'])
    vi.advanceTimersByTime(1000)
    expect(toastState.items).toHaveLength(0)
  })

  it('spreads out while focus is in it', async () => {
    toast({ message: '已删除', action: { label: '撤销', onClick: () => {} } })
    toast('已复制')
    await nextTick()
    const action = document.querySelector<HTMLButtonElement>('.dou-toast__action')!
    action.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await nextTick()
    expect(list().classList).toContain('is-expanded')
    vi.advanceTimersByTime(10_000)
    expect(toastState.items).toHaveLength(2)

    action.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    )
    await nextTick()
    expect(list().classList).not.toContain('is-expanded')
  })

  it('opens on a tap and closes on a tap elsewhere, but not on mouse presses', async () => {
    await show(2)
    items()[0]!.dispatchEvent(pointer('pointerdown'))
    await nextTick()
    expect(list().classList).not.toContain('is-expanded')

    // a finger sends enter and leave with the press; only the press counts
    list().dispatchEvent(pointer('pointerenter', 'touch'))
    items()[0]!.dispatchEvent(pointer('pointerdown', 'touch'))
    list().dispatchEvent(pointer('pointerleave', 'touch'))
    await nextTick()
    expect(list().classList).toContain('is-expanded')
    vi.advanceTimersByTime(5000)
    expect(toastState.items).toHaveLength(2)

    document.body.dispatchEvent(pointer('pointerdown', 'touch'))
    await nextTick()
    expect(list().classList).not.toContain('is-expanded')
  })

  it('always shows them spread out when not stacked', async () => {
    const wrapper = mount(DouToastViewport, { props: { stacked: false }, attachTo: document.body })
    await show(2)
    expect(offsets()).toEqual(['58px', '0px'])
    expect(items().some((el) => el.classList.contains('is-behind'))).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(toastState.items).toHaveLength(0)
    wrapper.unmount()
  })

  it('takes stacked from the configured defaults', async () => {
    const wrapper = mount(
      {
        render: () =>
          h(DouConfigProvider, { defaults: { DouToastViewport: { stacked: false } } }, () =>
            h(DouToastViewport),
          ),
      },
      { attachTo: document.body },
    )
    await show(2)
    expect(offsets()).toEqual(['58px', '0px'])
    wrapper.unmount()
  })
})
