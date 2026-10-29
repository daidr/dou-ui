import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DouButton,
  DouInput,
  DouToggle,
  DouToggleGroup,
  DouToolbar,
  DouToolbarSeparator,
} from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

function setup() {
  return mount(DouToolbar, {
    props: { size: 'sm' },
    attrs: { 'aria-label': '格式' },
    slots: {
      default: () => [
        h(DouToggle, { 'aria-label': '加粗' }, () => 'B'),
        h(DouToolbarSeparator),
        h(DouToggleGroup, { modelValue: 'left' }, () => [
          h(DouToggle, { value: 'left' }, () => 'L'),
          h(DouToggle, { value: 'right', disabled: true }, () => 'R'),
        ]),
        h(DouInput, { modelValue: 'abc' }),
        h(DouButton, () => '保存'),
      ],
    },
    attachTo: document.body,
  })
}

describe('DouToolbar', () => {
  it('is a toolbar that sizes its controls', () => {
    const wrapper = setup()
    expect(wrapper.attributes('role')).toBe('toolbar')
    expect(wrapper.attributes('aria-orientation')).toBe('horizontal')
    expect(wrapper.get('.dou-toolbar-separator').attributes('aria-orientation')).toBe('vertical')
    expect(wrapper.get('.dou-button').classes()).toContain('dou-button--sm')
    wrapper.unmount()
  })

  it('moves focus across every control, skipping disabled ones and leaving text fields alone', async () => {
    const wrapper = setup()
    const bold = wrapper.get('.dou-toggle').element as HTMLElement
    const left = wrapper.findAll('.dou-toggle')[1]!.element as HTMLElement
    const input = wrapper.get('input').element as HTMLElement
    bold.focus()
    bold.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(left)
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(input)
    expect(bold.tabIndex).toBe(-1)
    expect(input.tabIndex).toBe(0)
    // inside a text field the arrow keys move the cursor
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(input)
    wrapper.unmount()
  })
})
