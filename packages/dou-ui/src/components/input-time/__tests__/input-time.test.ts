import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouInputTime } from '../../../index'
import type { TimeRange } from '../../../index'

type Value = string | TimeRange | null | undefined

function make(props: Record<string, unknown> = {}) {
  const value = ref<Value>(props.modelValue as Value)
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(DouInputTime as never, {
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

const segments = () => [...document.querySelectorAll<HTMLElement>('[data-segment]')]
async function press(el: HTMLElement, key: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouInputTime', () => {
  it('types hours and minutes', async () => {
    const { wrapper, value } = make()
    expect(segments().map((el) => el.textContent)).toEqual(['时', '分'])
    segments()[0]!.focus()
    for (const key of '0930') await press(document.activeElement as HTMLElement, key)
    expect(value.value).toBe('09:30')
    wrapper.unmount()
  })

  it('takes seconds and a 12-hour display', () => {
    const { wrapper } = make({
      modelValue: '14:05:09',
      format: 'HH:mm:ss',
      displayFormat: 'hh:mm:ss A',
    })
    expect(segments().map((el) => el.textContent)).toEqual(['02', '05', '09', '下午'])
    wrapper.unmount()
  })

  it('steps minutes on the grid of minuteStep', async () => {
    const { wrapper, value } = make({ modelValue: '09:50', minuteStep: 15 })
    await press(segments()[1]!, 'ArrowUp')
    expect(value.value).toBe('09:00')
    await press(segments()[1]!, 'ArrowDown')
    expect(value.value).toBe('09:45')
    wrapper.unmount()
  })

  it('picks in the time columns with picker', async () => {
    const { wrapper, value } = make({ picker: true, modelValue: '09:30' })
    await wrapper.get('.dou-input-date__toggle').trigger('click')
    await nextTick()
    const hour = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (el) => el.textContent?.trim() === '14',
    )!
    hour.click()
    await nextTick()
    expect(value.value).toBe('14:30')
    wrapper.unmount()
  })
})
