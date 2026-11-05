import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import * as dou from '../../../index'
import { DouButton, DouChatContextMeter, DouTooltip } from '../../../index'
import { compactNumber, contextUsage } from '../chat-context-meter'

describe('DouChatContextMeter', () => {
  it('reads as a meter with the share used', async () => {
    const wrapper = mount(DouChatContextMeter, {
      props: { used: 45_200, total: 200_000, showLabel: true },
    })
    const meter = wrapper.get('[role="meter"]')
    expect(meter.attributes('aria-valuenow')).toBe('23')
    expect(meter.attributes('aria-valuetext')).toBe('上下文已用 45.2k / 200k（23%）')
    expect(meter.attributes('aria-label')).toBe('上下文用量')
    expect(meter.classes()).toContain('dou-chat-context-meter--neutral')
    expect(wrapper.get('.dou-chat-context-meter__label').text()).toBe('23%')
    await wrapper.setProps({ used: 170_000 })
    expect(meter.classes()).toContain('dou-chat-context-meter--warning')
    await wrapper.setProps({ used: 199_000 })
    expect(meter.classes()).toContain('dou-chat-context-meter--danger')
  })

  it('is only the ring: no tooltip, no focus of its own, attributes passed through', () => {
    const wrapper = mount(DouChatContextMeter, {
      props: { used: 1, total: 2 },
      attrs: { 'aria-label': '本次会话的上下文', 'data-x': 'y', class: 'mine' },
      attachTo: document.body,
    })
    const meter = wrapper.get('[role="meter"]')
    expect(meter.attributes('tabindex')).toBeUndefined()
    expect(meter.attributes('aria-label')).toBe('本次会话的上下文')
    expect(meter.attributes('data-x')).toBe('y')
    expect(meter.classes()).toContain('mine')
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    wrapper.unmount()
  })

  it('sits in a button as a tooltip trigger with one stop for the keyboard', () => {
    const wrapper = mount(() =>
      h(DouTooltip, { content: '上下文已用 1 / 2（50%）' }, () =>
        h(DouButton, { 'aria-label': '上下文用量' }, () =>
          h(DouChatContextMeter, { used: 1, total: 2 }),
        ),
      ),
    )
    expect(wrapper.findAll('[tabindex="0"]')).toHaveLength(0)
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.get('button').find('[role="meter"]').exists()).toBe(true)
  })

  it('works out the numbers as the ring does, for tooltips around it', () => {
    expect(contextUsage(45_200, 200_000)).toEqual({
      used: 45_200,
      total: 200_000,
      share: 0.226,
      percent: 23,
    })
    expect(contextUsage(210_000, 200_000).percent).toBe(100)
    expect(contextUsage(10, 0)).toEqual({ used: 10, total: 0, share: 0, percent: 0 })
    expect(contextUsage(Number.NaN, 100)).toMatchObject({ used: 0, percent: 0 })
    expect(contextUsage(-5, 100)).toMatchObject({ used: 0, percent: 0 })
    expect((dou as Record<string, unknown>).contextUsage).toBe(contextUsage)
  })

  it('counts a used or total that isn’t a finite number, or is below 0, as 0', () => {
    const wrapper = mount(DouChatContextMeter, {
      props: { used: Number.NaN, total: 100, showLabel: true },
    })
    const meter = wrapper.get('[role="meter"]')
    expect(meter.attributes('aria-valuenow')).toBe('0')
    expect(wrapper.get('.dou-chat-context-meter__label').text()).toBe('0%')
    expect(wrapper.html()).not.toContain('NaN')
    return wrapper.setProps({ used: -5 }).then(() => {
      expect(meter.attributes('aria-valuetext')).toBe('上下文已用 0 / 100（0%）')
    })
  })

  it('warns while developing when its label sits in a button', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(() =>
      h(
        'button',
        null,
        h(DouChatContextMeter, { used: 1, total: 2, showLabel: true, key: 'warn-in-button' }),
      ),
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`leading` slot'))
    warn.mockRestore()
    wrapper.unmount()
  })

  it('formats compact numbers, exported for tooltips around it', () => {
    expect(compactNumber(999)).toBe('999')
    expect(compactNumber(45_200)).toBe('45.2k')
    expect(compactNumber(1_000_000)).toBe('1M')
    expect((dou as Record<string, unknown>).compactNumber).toBe(compactNumber)
  })
})
