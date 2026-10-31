import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouTimePicker } from '../../../index'
import { fitTime, formatTime, isTimeDisabled, parseTime, snap } from '../time'
import type { DisabledTime } from '../time'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('time helpers', () => {
  it('parses loose input', () => {
    expect(parseTime('9')).toEqual({ hour: 9, minute: 0, second: 0 })
    expect(parseTime('9:5')).toEqual({ hour: 9, minute: 5, second: 0 })
    expect(parseTime('09：30：15')).toEqual({ hour: 9, minute: 30, second: 15 })
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('abc')).toBeNull()
  })

  it('formats and snaps to steps', () => {
    expect(formatTime({ hour: 9, minute: 5, second: 7 }, 'HH:mm')).toBe('09:05')
    expect(formatTime({ hour: 9, minute: 5, second: 7 }, 'HH:mm:ss')).toBe('09:05:07')
    expect(snap({ hour: 9, minute: 37, second: 0 }, [1, 15, 1])).toEqual({
      hour: 9,
      minute: 30,
      second: 0,
    })
  })
})

describe('DouTimePicker', () => {
  it('opens a dialog with hour and minute columns', async () => {
    const wrapper = mount(DouTimePicker, {
      props: { modelValue: '09:30' },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    expect(input.element.value).toBe('09:30')
    expect(input.attributes('aria-haspopup')).toBe('dialog')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    const columns = document.querySelectorAll('[role="listbox"]')
    expect([...columns].map((el) => el.getAttribute('aria-label'))).toEqual(['时', '分'])
    expect(columns[0]!.querySelectorAll('[role="option"]')).toHaveLength(24)
    expect(columns[1]!.querySelector('[aria-selected="true"]')!.textContent!.trim()).toBe('30')
    wrapper.unmount()
  })

  it('picks a time from the columns and with the arrow keys', async () => {
    const wrapper = mount(DouTimePicker, {
      props: {
        modelValue: '09:30',
        format: 'HH:mm:ss' as const,
        minuteStep: 15,
        'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as string }),
      },
      attachTo: document.body,
    })
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    const columns = document.querySelectorAll<HTMLElement>('[role="listbox"]')
    expect(columns).toHaveLength(3)
    expect(columns[1]!.querySelectorAll('[role="option"]')).toHaveLength(4)
    ;(columns[0]!.querySelectorAll('[role="option"]')[14] as HTMLElement).click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('14:30:00')
    columns[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('14:45:00')
    wrapper.unmount()
  })

  it('reads what was typed on Enter and puts back nonsense', async () => {
    const wrapper = mount(DouTimePicker, {
      props: {
        modelValue: '09:30',
        'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as string }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'Enter' })
    await input.setValue('7:5')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toBe('07:05')
    await input.trigger('keydown', { key: 'Enter' })
    await input.setValue('99:99')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toBe('07:05')
    expect(input.element.value).toBe('07:05')
    wrapper.unmount()
  })

  it('focuses the first text box', () => {
    const wrapper = mount(DouTimePicker, { props: { range: true }, attachTo: document.body })
    ;(wrapper.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(wrapper.findAll('input')[0]!.element)
    wrapper.unmount()
  })

  it('keeps a typed range in order', async () => {
    const wrapper = mount(DouTimePicker, {
      props: {
        range: true,
        modelValue: null,
        'onUpdate:modelValue': (v: unknown) =>
          wrapper.setProps({ modelValue: v as [string, string] }),
      },
      attachTo: document.body,
    })
    const [start, end] = wrapper.findAll('input')
    expect(start!.attributes('aria-label')).toBe('开始时间')
    await start!.setValue('18:00')
    await end!.setValue('9:00')
    await end!.trigger('keydown', { key: 'Enter' })
    await end!.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toEqual(['09:00', '18:00'])
    wrapper.unmount()
  })
})

const lunch: DisabledTime = {
  hour: (hour) => hour < 9 || hour === 12,
  minute: (minute, hour) => hour === 18 && minute > 0,
}

describe('disabled time', () => {
  it('checks a whole time and moves later parts off ruled-out values', () => {
    expect(isTimeDisabled({ hour: 12, minute: 0, second: 0 }, lunch, false)).toBe(true)
    expect(isTimeDisabled({ hour: 18, minute: 30, second: 0 }, lunch, false)).toBe(true)
    expect(isTimeDisabled({ hour: 18, minute: 0, second: 0 }, lunch, false)).toBe(false)
    expect(fitTime({ hour: 18, minute: 30, second: 0 }, lunch, [1, 15, 1], false)).toEqual({
      hour: 18,
      minute: 0,
      second: 0,
    })
    expect(fitTime({ hour: 7, minute: 30, second: 0 }, lunch, [1, 1, 1], false)).toEqual({
      hour: 9,
      minute: 30,
      second: 0,
    })
    expect(
      fitTime({ hour: 7, minute: 0, second: 0 }, { hour: () => true }, [1, 1, 1], false),
    ).toBeNull()
  })

  it('greys out rows, skips them with the keys and refuses typed times', async () => {
    const wrapper = mount(DouTimePicker, {
      props: {
        modelValue: '11:30',
        disabledTime: lunch,
        'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as string }),
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    const columns = document.querySelectorAll<HTMLElement>('[role="listbox"]')
    const hours = columns[0]!.querySelectorAll<HTMLElement>('[role="option"]')
    expect(hours[8]!.getAttribute('aria-disabled')).toBe('true')
    expect(hours[12]!.classList).toContain('is-disabled')
    hours[12]!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('11:30')
    // ↓ from 11 jumps over 12
    columns[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('13:30')
    // 18 only allows :00, so the minutes move
    hours[18]!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('18:00')

    await input.setValue('12:15')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('blur')
    await wrapper.setProps({})
    expect(wrapper.props('modelValue')).toBe('18:00')
    wrapper.unmount()
  })
})
