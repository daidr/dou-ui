import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import * as dou from '../../../index'
import { DouButton, DouChatContextMeter, DouTooltip } from '../../../index'
import { compactNumber } from '../chat-context-meter'

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

  it('formats compact numbers, exported for tooltips around it', () => {
    expect(compactNumber(999)).toBe('999')
    expect(compactNumber(45_200)).toBe('45.2k')
    expect(compactNumber(1_000_000)).toBe('1M')
    expect((dou as Record<string, unknown>).compactNumber).toBe(compactNumber)
  })
})
