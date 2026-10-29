import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouDialog, DouDrawer } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

const settle = async () => {
  await nextTick()
  await nextTick()
}
const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!

describe('DouDrawer resizable', () => {
  it('resizes from the inner edge with the pointer, within the limits', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, title: '详情', size: 320, resizable: true, minSize: 240, maxSize: 600 },
      attachTo: document.body,
    })
    await settle()
    const handle = document.querySelector<HTMLElement>('.dou-drawer__resizer')!
    expect(handle.getAttribute('role')).toBe('separator')
    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
    expect(handle.getAttribute('aria-label')).toBe('拖动调整大小')
    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: window.innerWidth - 320 }),
    )
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth - 450 }))
    await nextTick()
    expect(panel().style.getPropertyValue('--dou-drawer-size')).toBe('450px')
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth - 100 }))
    await nextTick()
    expect(panel().style.getPropertyValue('--dou-drawer-size')).toBe('240px')
    window.dispatchEvent(new PointerEvent('pointerup'))
    expect(wrapper.emitted('update:size')).toEqual([[450], [240]])
    expect(handle.getAttribute('aria-valuenow')).toBe('240')
    wrapper.unmount()
  })

  it('grows and shrinks with the arrow keys pointing away from its edge', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, placement: 'bottom', size: 300, resizable: true },
      attachTo: document.body,
    })
    await settle()
    const handle = document.querySelector<HTMLElement>('.dou-drawer__resizer')!
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal')
    await settle()
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }),
    )
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    const sizes = wrapper.emitted('update:size')!.map(([size]) => size as number)
    expect(sizes[1]! - sizes[0]!).toBe(64)
    expect(sizes[2]! - sizes[1]!).toBe(-16)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(wrapper.emitted('update:size')!.at(-1)).toEqual([200])
    wrapper.unmount()
  })
})

describe('DouDialog draggable and fullscreen', () => {
  it('moves by its header, back in place when reopened', async () => {
    const wrapper = mount(DouDialog, {
      props: { open: true, title: '编辑', draggable: true },
      attachTo: document.body,
    })
    await settle()
    panel().getBoundingClientRect = () =>
      ({ left: 200, top: 100, right: 680, bottom: 400, width: 480, height: 300 }) as DOMRect
    const header = document.querySelector<HTMLElement>('.dou-dialog__header')!
    header.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 120 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 340, clientY: 150 }))
    await nextTick()
    expect(panel().style.translate).toBe('40px 30px')
    // Not past the top-left of the viewport.
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0 }))
    await nextTick()
    expect(panel().style.translate).toBe('-200px -100px')
    window.dispatchEvent(new PointerEvent('pointerup'))
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await settle()
    expect(panel().style.translate).toBe('')
    wrapper.unmount()
  })

  it('toggles fullscreen from the header and pauses dragging', async () => {
    const wrapper = mount(DouDialog, {
      props: {
        open: true,
        title: '编辑',
        draggable: true,
        fullscreenable: true,
        'onUpdate:fullscreen': (value: boolean) => wrapper.setProps({ fullscreen: value }),
      },
      attachTo: document.body,
    })
    await settle()
    const toggle = document.querySelector<HTMLElement>('.dou-dialog__fullscreen')!
    expect(toggle.getAttribute('aria-label')).toBe('全屏')
    toggle.click()
    await settle()
    expect(document.querySelector('.dou-dialog')?.classList).toContain('is-fullscreen')
    expect(toggle.getAttribute('aria-label')).toBe('退出全屏')
    expect(panel().classList).not.toContain('is-draggable')
    wrapper.unmount()
  })
})
