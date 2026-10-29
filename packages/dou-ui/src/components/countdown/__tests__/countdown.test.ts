import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouCountdown } from '../../../index'
import { formatDuration } from '../format'

describe('formatDuration', () => {
  const ms = ((1 * 24 + 2) * 3600 + 3 * 60 + 4) * 1000 + 567

  it('fills the tokens, the largest taking the overflow', () => {
    expect(formatDuration(ms, 'D 天 HH:mm:ss')).toBe('1 天 02:03:04')
    expect(formatDuration(ms, 'HH:mm:ss')).toBe('26:03:04')
    expect(formatDuration(ms, 'mm:ss.SSS')).toBe('1563:04.567')
    expect(formatDuration(ms, 'ss.S')).toBe('93784.5')
  })

  it('keeps bracketed text and never goes below zero', () => {
    expect(formatDuration(5000, 's[ s 后重发]')).toBe('5 s 后重发')
    expect(formatDuration(-10, 'mm:ss')).toBe('00:00')
  })
})

describe('DouCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-29T08:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down to the target and finishes', async () => {
    const wrapper = mount(DouCountdown, {
      props: { value: Date.now() + 3000, format: 'mm:ss', title: '剩余' },
    })
    await nextTick()
    expect(wrapper.attributes('role')).toBe('timer')
    expect(wrapper.find('.dou-statistic__title').text()).toBe('剩余')
    expect(wrapper.find('.dou-statistic__value').text()).toBe('00:03')

    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('.dou-statistic__value').text()).toBe('00:02')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('.dou-statistic__value').text()).toBe('00:00')
    expect(wrapper.emitted('finish')).toHaveLength(1)
    wrapper.unmount()
  })

  it('starts again when the target moves', async () => {
    const wrapper = mount(DouCountdown, { props: { value: Date.now() + 1000, format: 's' } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.emitted('finish')).toHaveLength(1)
    await wrapper.setProps({ value: Date.now() + 60_000 })
    await nextTick()
    expect(wrapper.find('.dou-statistic__value').text()).toBe('60')
    wrapper.unmount()
  })
})
