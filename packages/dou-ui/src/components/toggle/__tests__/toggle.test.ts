import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouToggle, DouToggleGroup } from '../../../index'
import type { ToggleValue } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouToggle', () => {
  it('flips pressed and says so with aria-pressed', async () => {
    const pressed = ref(false)
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouToggle,
            {
              pressed: pressed.value,
              'onUpdate:pressed': (value: boolean) => (pressed.value = value),
            },
            () => '加粗',
          ),
      ),
    )
    const button = wrapper.get('button')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(pressed.value).toBe(true)
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.classes()).toContain('is-pressed')
  })
})

function setup(type: 'single' | 'multiple', initial: ToggleValue | ToggleValue[] | null) {
  const value = ref(initial)
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouToggleGroup,
          {
            type,
            modelValue: value.value,
            'onUpdate:modelValue': (next: typeof initial) => (value.value = next),
          },
          () =>
            ['left', 'center', 'right'].map((item) => h(DouToggle, { value: item }, () => item)),
        ),
    ),
    { attachTo: document.body },
  )
  return { wrapper, value }
}

describe('DouToggleGroup', () => {
  it('keeps one pressed with type single, and lets it go', async () => {
    const { wrapper, value } = setup('single', 'left')
    const buttons = wrapper.findAll('button')
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ])
    await buttons[2]!.trigger('click')
    expect(value.value).toBe('right')
    await buttons[2]!.trigger('click')
    expect(value.value).toBeNull()
    wrapper.unmount()
  })

  it('collects values with type multiple', async () => {
    const { wrapper, value } = setup('multiple', ['left'])
    const buttons = wrapper.findAll('button')
    await buttons[1]!.trigger('click')
    expect(value.value).toEqual(['left', 'center'])
    await buttons[0]!.trigger('click')
    expect(value.value).toEqual(['center'])
    wrapper.unmount()
  })

  it('moves focus with the arrow keys and keeps one toggle in the Tab order', async () => {
    const { wrapper } = setup('single', null)
    const buttons = wrapper.findAll('button')
    expect(buttons.map((button) => button.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    ;(buttons[0]!.element as HTMLElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    await buttons[1]!.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(buttons[2]!.element)
    await buttons[2]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    wrapper.unmount()
  })
})
