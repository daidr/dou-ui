import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouDrawer } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

const settle = async () => {
  await nextTick()
  await nextTick()
}
const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const handle = () => document.querySelector<HTMLElement>('.dou-drawer__handle')!

function drag(target: HTMLElement, from: number, to: number, pointerType = 'touch') {
  const init = { pointerId: 1, pointerType, button: 0, clientX: 100, bubbles: true }
  target.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientY: from }))
  const steps = 4
  for (let i = 1; i <= steps; i++)
    window.dispatchEvent(
      new PointerEvent('pointermove', { ...init, clientY: from + ((to - from) * i) / steps }),
    )
  window.dispatchEvent(new PointerEvent('pointerup', { ...init, clientY: to }))
}

describe('DouDrawer swipeable', () => {
  it('closes when dragged towards its edge', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, placement: 'bottom', swipeable: true, title: '筛选' },
      attachTo: document.body,
    })
    await settle()
    expect(handle().getAttribute('aria-hidden')).toBe('true')
    drag(handle(), 400, 700)
    await settle()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('does not drag without swipeable, nor from inputs', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, placement: 'bottom', title: '筛选' },
      slots: { default: '<input class="field" />' },
      attachTo: document.body,
    })
    await settle()
    expect(handle()).toBeNull()
    drag(panel(), 400, 700)
    await wrapper.setProps({ swipeable: true })
    drag(document.querySelector<HTMLElement>('.field')!, 400, 700)
    await settle()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })

  it('drags with a mouse only from the handle or header', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, placement: 'right', swipeable: true, title: '详情' },
      slots: { default: '<p class="text">正文</p>' },
      attachTo: document.body,
    })
    await settle()
    expect(handle()).toBeNull()
    const text = document.querySelector<HTMLElement>('.text')!
    const init = { pointerId: 1, pointerType: 'mouse', button: 0, clientY: 100, bubbles: true }
    text.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: 700 }))
    window.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: 900 }))
    window.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: 900 }))
    await settle()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    const header = document.querySelector<HTMLElement>('.dou-drawer__header')!
    header.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: 700 }))
    window.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: 800 }))
    window.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: 900 }))
    window.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: 900 }))
    await settle()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('stays open when beforeClose refuses', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, placement: 'bottom', swipeable: true, beforeClose: () => false },
      attachTo: document.body,
    })
    await settle()
    drag(handle(), 400, 700)
    await new Promise((resolve) => setTimeout(resolve))
    await settle()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(panel().style.transform).toBe('')
    wrapper.unmount()
  })
})

const half = () => Math.round(window.innerHeight / 2)

describe('DouDrawer snapPoints', () => {
  it('rests at the smallest snap point and moves to the nearest one on release', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, placement: 'bottom', swipeable: true, snapPoints: ['50%', '100%'] },
      attachTo: document.body,
    })
    await settle()
    expect(wrapper.emitted('update:snap')).toEqual([['50%']])
    expect(panel().style.getPropertyValue('--dou-drawer-size')).toBe(`${half()}px`)
    // dragged up by a third of the viewport: closer to full height
    drag(handle(), 400, 400 - Math.round(window.innerHeight / 3))
    await settle()
    expect(wrapper.emitted('update:snap')!.at(-1)).toEqual(['100%'])
    await wrapper.setProps({ snap: '100%' })
    expect(panel().style.getPropertyValue('--dou-drawer-size')).toBe(`${window.innerHeight}px`)
    wrapper.unmount()
  })

  it('closes when dragged well below the smallest snap point', async () => {
    const wrapper = mount(DouDrawer, {
      props: {
        open: true,
        placement: 'bottom',
        swipeable: true,
        snapPoints: [240, '90%'],
        snap: 240,
      },
      attachTo: document.body,
    })
    await settle()
    drag(handle(), 400, 560)
    await settle()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('cycles snap points from the handle, and steps with the arrow keys', async () => {
    const wrapper = mount(DouDrawer, {
      props: {
        open: true,
        placement: 'bottom',
        swipeable: true,
        snapPoints: ['30%', '60%', '100%'],
      },
      attachTo: document.body,
    })
    await settle()
    const button = handle()
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('aria-label')).toBe('切换高度')
    button.click()
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    button.click()
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(wrapper.emitted('update:snap')!.map(([v]) => v)).toEqual(['30%', '60%', '100%', '30%'])
    wrapper.unmount()
  })
})
