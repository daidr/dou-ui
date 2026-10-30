import { mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { DouConfigProvider, DouStatistic, zhCN } from '../../../index'
import { formatNumber } from '../format'

const opts = { groupSeparator: ',', decimalSeparator: '.' }

describe('formatNumber', () => {
  it('groups thousands and rounds to the precision', () => {
    expect(formatNumber(1234567.891, { ...opts, precision: 2 })).toEqual({
      sign: '',
      integer: '1,234,567',
      decimal: '.89',
    })
    expect(formatNumber(1234, opts)).toEqual({ sign: '', integer: '1,234', decimal: '' })
    expect(formatNumber(-0.5, { ...opts, precision: 0 })).toEqual({
      sign: '-',
      integer: '1',
      decimal: '',
    })
  })

  it('drops the sign of a value that rounds to zero', () => {
    expect(formatNumber(-0.001, { ...opts, precision: 2 }).sign).toBe('')
  })

  it('honours other separators', () => {
    expect(
      formatNumber(9876.5, { groupSeparator: ' ', decimalSeparator: ',', precision: 1 }),
    ).toEqual({ sign: '', integer: '9 876', decimal: ',5' })
    expect(formatNumber(9876, { ...opts, groupSeparator: '' }).integer).toBe('9876')
  })
})

describe('DouStatistic', () => {
  it('shows a labelled, formatted number with prefix and suffix', () => {
    const wrapper = mount(DouStatistic, {
      props: { title: '收入', value: 1284530.5, precision: 2, prefix: '¥', suffix: '元' },
    })
    expect(wrapper.find('.dou-statistic__title').text()).toBe('收入')
    expect(wrapper.find('.dou-statistic__value').text()).toBe('1,284,530.50')
    expect(wrapper.find('.dou-statistic__decimal').text()).toBe('.50')
    expect(wrapper.find('.dou-statistic__prefix').text()).toBe('¥')
    expect(wrapper.find('.dou-statistic__suffix').text()).toBe('元')
  })

  it('colors the trend by whether up is good', async () => {
    const wrapper = mount(DouStatistic, { props: { value: 3, trend: 'up' } })
    expect(wrapper.classes()).toContain('is-good')
    expect(wrapper.find('.dou-statistic__trend').attributes('aria-label')).toBe('上升')
    await wrapper.setProps({ upIsGood: false })
    expect(wrapper.classes()).toContain('is-bad')
    await wrapper.setProps({ trend: 'down' })
    expect(wrapper.classes()).toContain('is-good')
  })

  it('shows strings, a format function and missing values as given', async () => {
    const wrapper = mount(DouStatistic, { props: { value: null } })
    expect(wrapper.find('.dou-statistic__value').text()).toBe('—')
    await wrapper.setProps({ value: 'N/A' })
    expect(wrapper.find('.dou-statistic__value').text()).toBe('N/A')
    await wrapper.setProps({ value: 90, format: (v: number) => `${v / 60} 分钟` })
    expect(wrapper.find('.dou-statistic__value').text()).toBe('1.5 分钟')
  })

  it('holds the place while loading', () => {
    const wrapper = mount(DouStatistic, { props: { value: 1, loading: true } })
    expect(wrapper.find('.dou-statistic__placeholder').exists()).toBe(true)
    expect(wrapper.find('.dou-statistic__value').exists()).toBe(false)
    expect(wrapper.find('.dou-statistic__content').attributes('aria-busy')).toBe('true')
  })

  it('takes its separators from the locale', () => {
    const locale = {
      ...zhCN,
      region: { ...zhCN.region, groupSeparator: ' ', decimalSeparator: ',' },
    }
    const wrapper = mount(() =>
      h(DouConfigProvider, { locale }, () => h(DouStatistic, { value: 12345.6, precision: 1 })),
    )
    expect(wrapper.get('.dou-statistic__value').text()).toContain('12 345,6')
    wrapper.unmount()
  })

  it('counts to a new value, rounded on the way', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    // jsdom does not resolve the theme's tokens
    const style = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ getPropertyValue: () => '300ms' } as unknown as CSSStyleDeclaration)
    const wrapper = mount(DouStatistic, { props: { value: 100, precision: 1, animated: true } })
    const text = () => wrapper.get('.dou-statistic__value').text()
    expect(text()).toBe('100.0')
    await wrapper.setProps({ value: 200 })
    expect(text()).toBe('100.0')
    vi.advanceTimersByTime(100)
    await nextTick()
    const middle = Number(text())
    expect(middle).toBeGreaterThan(100)
    expect(middle).toBeLessThan(200)
    expect(text()).toMatch(/^\d+\.\d$/)
    vi.advanceTimersByTime(400)
    await nextTick()
    expect(text()).toBe('200.0')
    vi.useRealTimers()
    style.mockRestore()
  })

  it('jumps straight to the value without animated or with reduced motion', async () => {
    const style = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ getPropertyValue: () => '300ms' } as unknown as CSSStyleDeclaration)
    const plain = mount(DouStatistic, { props: { value: 1 } })
    await plain.setProps({ value: 5 })
    expect(plain.get('.dou-statistic__value').text()).toBe('5')

    const count = ref(1)
    const reduced = mount(DouConfigProvider, {
      props: { motion: 'none' },
      slots: { default: () => h(DouStatistic, { value: count.value, animated: true }) },
    })
    count.value = 9
    await nextTick()
    expect(reduced.get('.dou-statistic__value').text()).toBe('9')
    style.mockRestore()
  })
})
