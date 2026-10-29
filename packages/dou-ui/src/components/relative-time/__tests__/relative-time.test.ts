import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouConfigProvider, DouRelativeTime, en } from '../../../index'
import { formatMoment, nextChange, relativeUnit } from '../format'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const meridiem = { am: 'AM', pm: 'PM' }

describe('relative time helpers', () => {
  it('picks the largest whole unit, rounding toward zero', () => {
    expect(relativeUnit(-30_000)).toBeNull()
    expect(relativeUnit(-59 * MINUTE)).toMatchObject({ unit: 'minute', count: -59 })
    expect(relativeUnit(-HOUR)).toMatchObject({ unit: 'hour', count: -1 })
    expect(relativeUnit(3 * DAY)).toMatchObject({ unit: 'day', count: 3 })
    expect(relativeUnit(-400 * DAY)).toMatchObject({ unit: 'year', count: -1 })
  })

  it('waits until the text would change', () => {
    expect(nextChange(-90_000)).toBe(30_000)
    expect(nextChange(-(2 * HOUR + 10 * MINUTE))).toBe(50 * MINUTE)
    expect(nextChange(-10_000)).toBe(35_000)
  })

  it('formats moments through a pattern', () => {
    const time = new Date(2026, 9, 29, 14, 5, 9).getTime()
    expect(formatMoment(time, 'YYYY-MM-DD HH:mm:ss', meridiem)).toBe('2026-10-29 14:05:09')
    expect(formatMoment(time, 'MM/DD/YYYY hh:mm A', meridiem)).toBe('10/29/2026 02:05 PM')
    expect(formatMoment(time, 'YYYY[年]MM[月]', meridiem)).toBe('2026年10月')
  })
})

describe('DouRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a time element with the full moment in its title', () => {
    const value = new Date(2026, 9, 29, 11, 57, 0)
    const wrapper = mount(DouRelativeTime, { props: { value } })
    const time = wrapper.find('time')
    expect(time.text()).toBe('3分钟前')
    expect(time.attributes('datetime')).toBe(value.toISOString())
    expect(time.attributes('title')).toBe('2026-10-29 11:57')
  })

  it('says just now, then counts up as time passes', async () => {
    const wrapper = mount(DouRelativeTime, { props: { value: Date.now() } })
    expect(wrapper.text()).toBe('刚刚')
    await vi.advanceTimersByTimeAsync(45_000)
    await nextTick()
    expect(wrapper.text()).toBe('1分钟前')
    await vi.advanceTimersByTimeAsync(2 * MINUTE + 15_000)
    await nextTick()
    expect(wrapper.text()).toBe('3分钟前')
  })

  it('uses words such as yesterday, unless numeric is always', () => {
    const value = Date.now() - DAY
    expect(mount(DouRelativeTime, { props: { value } }).text()).toBe('昨天')
    expect(mount(DouRelativeTime, { props: { value, numeric: 'always' } }).text()).toBe('1天前')
  })

  it('switches to the date after absoluteAfter', () => {
    const wrapper = mount(DouRelativeTime, {
      props: { value: new Date(2026, 8, 1), absoluteAfter: 7 * DAY },
    })
    expect(wrapper.text()).toBe('2026-09-01')
  })

  it('follows the locale and a fixed now', () => {
    const wrapper = mount({
      render: () =>
        h(DouConfigProvider, { locale: en }, () =>
          h(DouRelativeTime, { value: '2026-10-27T12:00:00Z', now: '2026-10-29T12:00:00Z' }),
        ),
    })
    expect(wrapper.text()).toBe('2 days ago')
  })
})
