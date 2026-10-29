import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouTooltip } from '../../../index'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const panel = () => document.querySelector<HTMLElement>('.dou-tooltip')!
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))

describe('DouTooltip follow and interactive', () => {
  it('sits next to the pointer with followCursor', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800)
    const wrapper = mount(DouTooltip, {
      props: { content: '戴兜', open: true, followCursor: true, placement: 'bottom-start' },
      slots: { default: () => h('button', 'trigger') },
      attachTo: document.body,
    })
    await nextTick()
    await wrapper.get('button').trigger('pointermove', { clientX: 120, clientY: 80 })
    await nextTick()
    await frame()
    // bottom-start: left edge at the pointer, below it by offset 6 + 10
    expect(panel().style.left).toBe('120px')
    expect(panel().style.top).toBe('96px')
    expect(panel().classList).toContain('is-static')
  })

  it('stays open over the panel only when interactive', async () => {
    const wrapper = mount(DouTooltip, {
      props: { content: 'c', open: true, interactive: false },
      slots: { default: () => h('button', 'trigger') },
      attachTo: document.body,
    })
    await nextTick()
    expect(panel().classList).toContain('is-static')
    await wrapper.setProps({ interactive: true })
    expect(panel().classList).not.toContain('is-static')
  })
})
