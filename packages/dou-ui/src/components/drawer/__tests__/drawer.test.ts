import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
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

describe('DouDrawer', () => {
  it('slides from the chosen edge at the given size', async () => {
    const wrapper = mount(DouDrawer, {
      props: { open: true, title: '详情', placement: 'left', size: 320 },
      attachTo: document.body,
    })
    await settle()
    expect(document.querySelector('.dou-drawer')?.classList).toContain('dou-drawer--left')
    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(panel.style.getPropertyValue('--dou-drawer-size')).toBe('320px')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(panel)
    wrapper.unmount()
  })

  it('closes the topmost of two stacked layers on Escape', async () => {
    const closed: boolean[] = []
    const wrapper = mount(
      {
        render: () =>
          h(DouDrawer, { open: true, title: '外层' }, () =>
            h(DouDialog, {
              open: true,
              title: '内层',
              'onUpdate:open': (value: boolean) => closed.push(value),
            }),
          ),
      },
      { attachTo: document.body },
    )
    await settle()
    const [drawer, dialog] = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
    expect(Number(dialog!.parentElement!.style.zIndex)).toBeGreaterThan(
      Number(drawer!.parentElement!.style.zIndex),
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closed).toEqual([false])
    wrapper.unmount()
  })
})
