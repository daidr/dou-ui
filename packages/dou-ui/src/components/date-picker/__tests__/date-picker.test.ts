import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouCalendar, DouConfigProvider, DouDatePicker, en } from '../../../index'
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

  it('picks a quarter, and a range of months', async () => {
    const quarter = make(DouCalendar, { type: 'quarter', modelValue: '2026-Q2' })
    expect(quarter.wrapper.findAll('.dou-calendar__day').map((cell) => cell.text())).toEqual([
      '1 季度',
      '2 季度',
      '3 季度',
      '4 季度',
    ])
    expect(quarter.wrapper.get('[data-value="2026-Q2"]').classes()).toContain('is-selected')
    expect(quarter.wrapper.get('[data-value="2026-Q4"]').classes()).toContain('is-today')
    await quarter.wrapper.get('[data-value="2026-Q3"]').trigger('click')
    expect(quarter.value.value).toBe('2026-Q3')
    quarter.wrapper.unmount()

    const { wrapper, value } = make(DouCalendar, { type: 'month', range: true })
    await wrapper.get('[data-value="2026-08"]').trigger('click')
    await wrapper.get('[data-value="2026-03"]').trigger('mouseenter')
    expect(wrapper.get('[data-value="2026-05"]').element.parentElement!.className).toContain(
      'is-in-range',
    )
    await wrapper.get('[data-value="2026-03"]').trigger('click')
    expect(value.value).toEqual(['2026-03', '2026-08'])
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

  it('stays open while moving around inside the calendar', async () => {
    const { wrapper } = make(DouDatePicker, { modelValue: '2026-10-08' })
    const input = wrapper.get('input')
    await wrapper.get('.dou-date-picker').trigger('mousedown')
    const panel = document.getElementById(input.attributes('aria-controls')!)!
    const next = panel.querySelectorAll<HTMLButtonElement>('.dou-calendar__step')[1]!
    next.focus()
    next.click()
    await nextTick()
    // the month changes but the arrow is the same button, still focused
    expect(panel.querySelectorAll('.dou-calendar__step')[1]).toBe(next)
    expect(document.activeElement).toBe(next)
    // a button that goes away with its view drops focus without leaving
    const title = panel.querySelector<HTMLButtonElement>('.dou-calendar__title')!
    title.focus()
    title.click()
    title.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))
    await nextTick()
    await nextTick()
    expect(input.attributes('aria-expanded')).toBe('true')
    // pressing between buttons keeps focus where it was
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    panel.dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)
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
  it('picks a whole week', async () => {
    const { wrapper, value } = make(DouDatePicker, { modelValue: '2026-W44', type: 'week' })
    await wrapper.get('.dou-date-picker').trigger('mousedown')
    // the week is drawn from Monday to Sunday
    expect(day('2026-10-26').classList).toContain('is-selected')
    expect(day('2026-11-01').classList).toContain('is-selected')
    expect(day('2026-10-28').parentElement!.classList).toContain('is-in-range')
    day('2026-11-05').click()
    await nextTick()
    expect(value.value).toBe('2026-W45')
    expect(wrapper.get('input').element.value).toBe('2026-W45')
    wrapper.unmount()
  })

  it('puts a day and a time together and commits on confirm', async () => {
    const { wrapper, value } = make(DouDatePicker, { type: 'datetime' })
    const input = wrapper.get('input')
    expect(input.attributes('placeholder')).toBe('选择日期时间')
    await wrapper.get('.dou-date-picker').trigger('mousedown')
    day('2026-10-15').click()
    await nextTick()
    // picking a day does not close the panel or commit yet
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(value.value).toBeUndefined()
    const hours = document.querySelectorAll('.dou-time-picker__column')[0]!
    hours.querySelectorAll<HTMLElement>('li')[9]!.click()
    await nextTick()
    const minutes = document.querySelectorAll('.dou-time-picker__column')[1]!
    minutes.querySelectorAll<HTMLElement>('li')[30]!.click()
    await nextTick()
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('.dou-date-picker__footer button'),
    ]
    buttons.find((button) => button.textContent!.trim() === '确定')!.click()
    await nextTick()
    expect(value.value).toBe('2026-10-15 09:30')
    expect(input.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('types a day and a time, and fills in the default time', async () => {
    const { wrapper, value } = make(DouDatePicker, {
      type: 'datetime',
      timeFormat: 'HH:mm:ss',
      defaultTime: '08:00',
    })
    const input = wrapper.get('input')
    await input.setValue('2026/10/3 14:5')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-10-03 14:05:00')
    await input.setValue('2026-10-04')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-10-04 08:00:00')
    wrapper.unmount()
  })

  it('ends a datetime range at the end of the day', async () => {
    const { wrapper, value } = make(DouDatePicker, { type: 'datetime', range: true })
    await wrapper.get('.dou-date-picker').trigger('mousedown')
    day('2026-10-20').click()
    await nextTick()
    day('2026-10-05').click()
    await nextTick()
    expect(document.querySelectorAll('.dou-time-picker__columns')).toHaveLength(2)
    const confirm = [
      ...document.querySelectorAll<HTMLButtonElement>('.dou-date-picker__footer button'),
    ].at(-1)!
    confirm.click()
    await nextTick()
    expect(value.value).toEqual(['2026-10-05 00:00', '2026-10-20 23:59'])
    wrapper.unmount()
  })

  it('picks a shortcut', async () => {
    const { wrapper, value } = make(DouDatePicker, {
      range: true,
      shortcuts: [
        { label: '十月', value: ['2026-10-01', '2026-10-31'] },
        { label: '最近 7 天', value: () => ['2026-10-22', '2026-10-28'] },
      ],
    })
    await wrapper.get('.dou-date-picker').trigger('mousedown')
    const shortcuts = document.querySelectorAll<HTMLButtonElement>('.dou-date-picker__shortcut')
    expect([...shortcuts].map((button) => button.textContent!.trim())).toEqual([
      '十月',
      '最近 7 天',
    ])
    shortcuts[1]!.click()
    await nextTick()
    expect(value.value).toEqual(['2026-10-22', '2026-10-28'])
    expect(wrapper.get('input').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('shows and reads the day through a display format', async () => {
    const { wrapper, value } = make(DouDatePicker, {
      modelValue: '2026-10-08',
      displayFormat: 'DD.MM.YYYY',
    })
    const input = wrapper.get('input')
    expect(input.element.value).toBe('08.10.2026')
    await input.setValue('2.11.2026')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-11-02')
    expect(input.element.value).toBe('02.11.2026')
    // ISO text still works
    await input.setValue('2026-12-01')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-12-01')
    wrapper.unmount()
  })

  it('writes a month and a datetime through a display format', async () => {
    const month = make(DouDatePicker, {
      type: 'month',
      modelValue: '2026-10',
      displayFormat: 'YYYY[年]MM[月]',
    })
    expect(month.wrapper.get('input').element.value).toBe('2026年10月')
    month.wrapper.unmount()

    const { wrapper, value } = make(DouDatePicker, {
      type: 'datetime',
      modelValue: '2026-10-08 09:30',
      displayFormat: 'DD/MM/YYYY',
    })
    const input = wrapper.get('input')
    expect(input.element.value).toBe('08/10/2026 09:30')
    await input.setValue('03/10/2026 14:05')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-10-03 14:05')
    wrapper.unmount()
  })

  it('writes and reads quarters as the locale does', async () => {
    const { wrapper, value } = make(DouDatePicker, { type: 'quarter', modelValue: '2026-Q4' })
    const input = wrapper.get('input')
    expect(input.element.value).toBe('2026 年第 4 季度')
    expect(input.attributes('placeholder')).toBe('选择季度')
    await input.setValue('2027 年第 1 季度')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2027-Q1')
    await input.setValue('Q3 2026')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('2026-Q3')
    wrapper.unmount()

    const english = mount(
      () =>
        h(DouConfigProvider, { locale: en }, () =>
          h(DouDatePicker, { modelValue: '2026-Q4', type: 'quarter' }),
        ),
      { attachTo: document.body },
    )
    expect(english.get('input').element.value).toBe('Q4 2026')
    english.unmount()
  })

  it('follows the locale for the pattern and the first day of the week', async () => {
    const wrapper = mount(
      () =>
        h(DouConfigProvider, { locale: en }, () => [
          h(DouDatePicker, { modelValue: '2026-10-08' }),
          h(DouCalendar, { modelValue: '2026-10-08' }),
        ]),
      { attachTo: document.body },
    )
    expect(wrapper.get('input').element.value).toBe('10/08/2026')
    // October 2026 starts on a Thursday: four days of September lead a Sunday-first grid
    const first = wrapper.get('.dou-calendar [data-value]')
    expect(first.attributes('data-value')).toBe('2026-09-27')
    wrapper.unmount()
  })
})
