import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatContextMeter } from '../../../index'
import { compactNumber } from '../chat-context-meter'

describe('DouChatContextMeter', () => {
  it('reads as a meter with the share used', async () => {
    const wrapper = mount(DouChatContextMeter, {
      props: { used: 45_200, total: 200_000, showLabel: true },
    })
    const meter = wrapper.get('[role="meter"]')
    expect(meter.attributes('aria-valuenow')).toBe('23')
    expect(meter.attributes('aria-valuetext')).toBe('上下文已用 45.2k / 200k（23%）')
    expect(meter.classes()).toContain('dou-chat-context-meter--neutral')
    expect(wrapper.get('.dou-chat-context-meter__label').text()).toBe('23%')
    await wrapper.setProps({ used: 170_000 })
    expect(meter.classes()).toContain('dou-chat-context-meter--warning')
    await wrapper.setProps({ used: 199_000 })
    expect(meter.classes()).toContain('dou-chat-context-meter--danger')
  })

  it('formats compact numbers', () => {
    expect(compactNumber(999)).toBe('999')
    expect(compactNumber(45_200)).toBe('45.2k')
    expect(compactNumber(1_000_000)).toBe('1M')
  })
})
