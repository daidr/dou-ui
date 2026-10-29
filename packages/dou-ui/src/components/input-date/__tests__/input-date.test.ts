import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouConfigProvider, DouInputDate, en } from '../../../index'
import type { DateRange } from '../../../index'

type Value = string | DateRange | null | undefined

function make(props: Record<string, unknown> = {}, locale?: typeof en) {
  const value = ref<Value>(props.modelValue as Value)
  const onChange = vi.fn<(value: Value) => void>()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () => {
          const field = h(DouInputDate as never, {
            ...props,
            modelValue: value.value,
            'onUpdate:modelValue': (next: Value) => (value.value = next),
            onChange,
          })
          return locale ? h(DouConfigProvider, { locale }, () => field) : field
        }
      },
    }),
    { attachTo: document.body },
  )
  return { wrapper, value, onChange }
}

const segments = () => [...document.querySelectorAll<HTMLElement>('[data-segment]')]
const texts = () => segments().map((el) => el.textContent)

async function press(el: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  await nextTick()
}

async function type(chars: string) {
  for (const char of chars) await press(document.activeElement as HTMLElement, char)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 12))
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('DouInputDate', () => {
  it('shows a part per field in the locale order', () => {
    const { wrapper } = make({ modelValue: '2026-10-29' })
    expect(texts()).toEqual(['2026', '10', '29'])
    expect(wrapper.findAll('.dou-input-date__literal').map((el) => el.text())).toEqual(['-', '-'])
    expect(segments()[1]!.getAttribute('role')).toBe('spinbutton')
    expect(segments()[1]!.getAttribute('aria-valuenow')).toBe('10')
    wrapper.unmount()
  })

  it('follows the locale and a display format', () => {
    const { wrapper } = make({ modelValue: '2026-10-29' }, en)
    expect(texts()).toEqual(['10', '29', '2026'])
    wrapper.unmount()
    const custom = make({ modelValue: '2026-10-29', displayFormat: 'DD.MM.YYYY' })
    expect(texts()).toEqual(['29', '10', '2026'])
    custom.wrapper.unmount()
  })

  it('shows placeholders while empty', () => {
    const { wrapper } = make()
    expect(texts()).toEqual(['年', '月', '日'])
    expect(segments()[0]!.classList.contains('is-placeholder')).toBe(true)
    wrapper.unmount()
  })

  it('types a date part by part, moving on by itself', async () => {
    const { wrapper, value, onChange } = make()
    segments()[0]!.focus()
    await type('2026')
    expect(document.activeElement).toBe(segments()[1])
    await type('3')
    // 3 can't start a two-digit month, so it is done
    expect(document.activeElement).toBe(segments()[2])
    expect(value.value).toBeFalsy()
    await type('7')
    expect(value.value).toBe('2026-03-07')
    expect(onChange).toHaveBeenCalledWith('2026-03-07')
    wrapper.unmount()
  })

  it('waits for a second digit when one could follow', async () => {
    const { wrapper, value } = make({ modelValue: '2026-10-29' })
    segments()[1]!.focus()
    await type('1')
    expect(segments()[1]!.textContent).toBe('1')
    // not committed while a second digit could still come
    expect(value.value).toBe('2026-10-29')
    await type('1')
    expect(value.value).toBe('2026-11-29')
    expect(document.activeElement).toBe(segments()[2])
    wrapper.unmount()
  })

  it('steps parts with the arrow keys and pulls the day into the month', async () => {
    const { wrapper, value } = make({ modelValue: '2026-01-31' })
    const [, month, day] = segments()
    await press(month!, 'ArrowUp')
    expect(value.value).toBe('2026-02-28')
    await press(day!, 'ArrowUp')
    expect(value.value).toBe('2026-02-01')
    await press(month!, 'ArrowDown')
    await press(month!, 'ArrowDown')
    expect(value.value).toBe('2026-12-01')
    await press(day!, 'End')
    expect(value.value).toBe('2026-12-31')
    await press(segments()[0]!, 'PageUp')
    expect(value.value).toBe('2036-12-31')
    wrapper.unmount()
  })

  it('starts an empty year at this year', async () => {
    const { wrapper } = make()
    await press(segments()[0]!, 'ArrowUp')
    expect(segments()[0]!.textContent).toBe('2026')
    wrapper.unmount()
  })

  it('clears with Backspace and goes back from an empty part', async () => {
    const { wrapper, value } = make({ modelValue: '2026-10-29' })
    const day = segments()[2]!
    day.focus()
    await press(day, 'Backspace')
    expect(day.textContent).toBe('日')
    expect(value.value).toBeNull()
    await press(day, 'Backspace')
    expect(document.activeElement).toBe(segments()[1])
    wrapper.unmount()
  })

  it('moves on when a separator is typed', async () => {
    const { wrapper } = make()
    segments()[0]!.focus()
    await type('2026')
    await type('1-')
    expect(document.activeElement).toBe(segments()[2])
    expect(segments()[1]!.textContent).toBe('01')
    wrapper.unmount()
  })

  it('marks a value outside min and max as invalid and keeps it out of the model', async () => {
    const { wrapper, value } = make({ modelValue: '2026-10-29', max: '2026-10-31' })
    await press(segments()[1]!, 'ArrowUp')
    expect(value.value).toBeNull()
    expect(wrapper.get('.dou-input-date').classes()).toContain('is-invalid')
    await press(segments()[1]!, 'ArrowDown')
    expect(value.value).toBe('2026-10-29')
    expect(wrapper.get('.dou-input-date').classes()).not.toContain('is-invalid')
    wrapper.unmount()
  })

  it('types a datetime on a 12-hour clock', async () => {
    const { wrapper, value } = make({ type: 'datetime' }, en)
    expect(texts()).toEqual(['mm', 'dd', 'yyyy', 'hh', 'mm', '--'])
    segments()[0]!.focus()
    await type('10292026')
    await type('9')
    await type('30')
    expect(value.value).toBeFalsy()
    await type('p')
    expect(value.value).toBe('2026-10-29 21:30')
    wrapper.unmount()
  })

  it('reads a pasted value', async () => {
    const { wrapper, value } = make()
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => '2026/1/5' } })
    segments()[0]!.dispatchEvent(event)
    await nextTick()
    expect(value.value).toBe('2026-01-05')
    wrapper.unmount()
  })

  it('types a range, put in order', async () => {
    const { wrapper, value } = make({ range: true })
    expect(segments()).toHaveLength(6)
    segments()[0]!.focus()
    await type('20261231')
    await type('20260101')
    expect(value.value).toEqual(['2026-01-01', '2026-12-31'])
    expect(segments()[0]!.getAttribute('aria-label')).toBe('开始日期 年')
    wrapper.unmount()
  })

  it('follows a value set from outside', async () => {
    const { wrapper, value } = make({ modelValue: '2026-10-29' })
    value.value = '2027-01-02'
    await nextTick()
    expect(texts()).toEqual(['2027', '01', '02'])
    wrapper.unmount()
  })

  it('clears everything with the clear button', async () => {
    const { wrapper, value } = make({ modelValue: '2026-10-29', clearable: true })
    await wrapper.get('.dou-input-date__clear').trigger('click')
    expect(value.value).toBeNull()
    expect(texts()).toEqual(['年', '月', '日'])
    wrapper.unmount()
  })

  it('does not edit when readonly or disabled', async () => {
    const { wrapper, value } = make({ modelValue: '2026-10-29', readonly: true })
    await press(segments()[0]!, 'ArrowUp')
    expect(value.value).toBe('2026-10-29')
    expect(segments()[0]!.hasAttribute('contenteditable')).toBe(false)
    wrapper.unmount()
    make({ disabled: true })
    expect(segments()[0]!.hasAttribute('tabindex')).toBe(false)
  })

  it('picks a day in the calendar with picker', async () => {
    const { wrapper, value } = make({ type: 'datetime', picker: true })
    await wrapper.get('.dou-input-date__toggle').trigger('click')
    await nextTick()
    document.querySelector<HTMLButtonElement>('[data-value="2026-10-08"]')!.click()
    await nextTick()
    expect(value.value).toBe('2026-10-08 00:00')
    wrapper.unmount()
  })
})
