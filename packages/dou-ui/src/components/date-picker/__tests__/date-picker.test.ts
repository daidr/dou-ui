import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouCalendar, DouDatePicker } from '../../../index'
import type { DateRange } from '../../../index'

type Value = string | DateRange | null | undefined

function make(
  component: typeof DouCalendar | typeof DouDatePicker,
  props: Record<string, unknown> = {},
) {
  const value = ref<Value>(props.modelValue as Value)
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(component as never, {
            ...props,
            modelValue: value.value,
            'onUpdate:modelValue': (next: Value) => (value.value = next),
          })
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, value }
}

const day = (date: string) => document.querySelector<HTMLButtonElement>(`[data-value="${date}"]`)!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 28, 12))
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('DouCalendar', () => {
  it('shows the month of the value with a grid of days', () => {
    const { wrapper } = make(DouCalendar, { modelValue: '2026-10-08' })
    expect(wrapper.get('.dou-calendar__title').text()).toBe('2026年10月')
    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers[0]).toBe('周一')
    // Monday first: October 2026 starts on a Thursday, so the grid opens on 9-28
    expect(wrapper.findAll('[data-value]')[0]!.attributes('data-value')).toBe('2026-09-28')
    expect(wrapper.findAll('[data-value]')).toHaveLength(42)
    const selected = wrapper.get('[data-value="2026-10-08"]')
    expect(selected.classes()).toContain('is-selected')
    expect(selected.attributes('tabindex')).toBe('0')
    expect(selected.element.parentElement!.getAttribute('aria-selected')).toBe('true')
    expect(wrapper.get('[data-value="2026-10-28"]').attributes('aria-current')).toBe('date')
    wrapper.unmount()
  })

  it('starts weeks on Sunday when asked', () => {
    const { wrapper } = make(DouCalendar, { modelValue: '2026-10-08', weekStart: 0 })
    expect(wrapper.findAll('[data-value]')[0]!.attributes('data-value')).toBe('2026-09-27')
    wrapper.unmount()
  })

  it('picks a day, and skips disabled ones', async () => {
    const { wrapper, value } = make(DouCalendar, {
      modelValue: '2026-10-08',
      min: '2026-10-05',
      disabledDate: (date: string) => date === '2026-10-20',
    })
    await wrapper.get('[data-value="2026-10-03"]').trigger('click')
    await wrapper.get('[data-value="2026-10-20"]').trigger('click')
    expect(value.value).toBe('2026-10-08')
    expect(wrapper.get('[data-value="2026-10-20"]').attributes('aria-disabled')).toBe('true')
    await wrapper.get('[data-value="2026-10-21"]').trigger('click')
    expect(value.value).toBe('2026-10-21')
    wrapper.unmount()
  })

  it('moves through days with the keyboard', async () => {
    const { wrapper, value } = make(DouCalendar, { modelValue: '2026-10-31' })
    const grid = wrapper.get('.dou-calendar__panels')
    day('2026-10-31').focus()
    await grid.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(wrapper.get('.dou-calendar__title').text()).toBe('2026年11月')
    expect(document.activeElement).toBe(day('2026-11-01'))
    await grid.trigger('keydown', { key: 'ArrowDown' })
    await grid.trigger('keydown', { key: 'PageUp' })
    await nextTick()
    expect(document.activeElement).toBe(day('2026-10-08'))
    await grid.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-10-08')
    wrapper.unmount()
  })

  it('goes up to months and years and back down', async () => {
    const { wrapper, value } = make(DouCalendar, { modelValue: '2026-10-08' })
    await wrapper.get('.dou-calendar__title').trigger('click')
    expect(wrapper.get('.dou-calendar__title').text()).toBe('2026年')
    await wrapper.get('.dou-calendar__title').trigger('click')
    expect(wrapper.get('.dou-calendar__title').text()).toBe('2020 – 2029')
    await wrapper.get('[data-value="2024"]').trigger('click')
    await wrapper.get('[data-value="2024-02"]').trigger('click')
    expect(wrapper.get('.dou-calendar__title').text()).toBe('2024年2月')
    expect(value.value).toBe('2026-10-08')
    wrapper.unmount()
  })

  it('picks a month with type month', async () => {
    const { wrapper, value } = make(DouCalendar, { type: 'month', modelValue: '2026-03' })
    expect(wrapper.get('[data-value="2026-03"]').classes()).toContain('is-selected')
    await wrapper.get('[data-value="2026-07"]').trigger('click')
    expect(value.value).toBe('2026-07')
    wrapper.unmount()
  })

  it('picks a range over two months', async () => {
    const { wrapper, value } = make(DouCalendar, { range: true })
    expect(wrapper.findAll('.dou-calendar__title').map((title) => title.text())).toEqual([
      '2026年10月',
      '2026年11月',
    ])
    await wrapper.get('[data-value="2026-11-03"]').trigger('click')
    expect(value.value).toBeUndefined()
    await wrapper.get('[data-value="2026-10-20"]').trigger('mouseenter')
    expect(wrapper.get('[data-value="2026-10-25"]').element.parentElement!.className).toContain(
      'is-in-range',
    )
    await wrapper.get('[data-value="2026-10-20"]').trigger('click')
    expect(value.value).toEqual(['2026-10-20', '2026-11-03'])
    wrapper.unmount()
  })
})

describe('DouDatePicker', () => {
  it('opens the calendar and closes on a pick', async () => {
    const { wrapper, value } = make(DouDatePicker, { modelValue: '2026-10-08' })
    const input = wrapper.get('input')
    expect(input.element.value).toBe('2026-10-08')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('false')
    await wrapper.get('.dou-date-picker').trigger('mousedown')
    expect(input.attributes('aria-expanded')).toBe('true')
    const panel = document.getElementById(input.attributes('aria-controls')!)!
    expect(panel.getAttribute('role')).toBe('dialog')
    day('2026-10-15').click()
    await nextTick()
    expect(value.value).toBe('2026-10-15')
    expect(input.element.value).toBe('2026-10-15')
    expect(input.attributes('aria-expanded')).toBe('false')
    expect(wrapper.findComponent(DouDatePicker).emitted('change')).toEqual([['2026-10-15']])
    wrapper.unmount()
  })

  it('takes a typed date on Enter and puts back nonsense', async () => {
    const { wrapper, value } = make(DouDatePicker, { modelValue: '2026-10-08', max: '2026-12-31' })
    const input = wrapper.get('input')
    await input.setValue('2026/11/2')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-11-02')
    await input.setValue('2027-01-01')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-11-02')
    expect(input.element.value).toBe('2026-11-02')
    wrapper.unmount()
  })

  it('picks today from the footer and clears', async () => {
    const { wrapper, value } = make(DouDatePicker, { clearable: true })
    expect(wrapper.get('input').attributes('placeholder')).toBe('选择日期')
    await wrapper.get('.dou-date-picker').trigger('mousedown')
    const today = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '今天',
    )!
    today.click()
    await nextTick()
    expect(value.value).toBe('2026-10-28')
    await wrapper.get('.dou-date-picker__clear').trigger('click')
    expect(value.value).toBeNull()
    wrapper.unmount()
  })

  it('puts attributes on the field', () => {
    const { wrapper } = make(DouDatePicker, { style: 'width: 200px', class: 'mine' })
    const field = wrapper.get('.dou-date-picker')
    expect(field.attributes('style')).toContain('width: 200px')
    expect(field.classes()).toContain('mine')
    wrapper.unmount()
  })

  it('edits a range in two fields', async () => {
    const { wrapper, value } = make(DouDatePicker, { range: true })
    const inputs = wrapper.findAll('input')
    expect(inputs.map((input) => input.attributes('placeholder'))).toEqual(['开始日期', '结束日期'])
    await inputs[0]!.setValue('2026-10-20')
    await inputs[1]!.setValue('2026-10-01')
    await inputs[1]!.trigger('keydown', { key: 'Enter' })
    expect(value.value).toEqual(['2026-10-01', '2026-10-20'])
    wrapper.unmount()
  })
})
