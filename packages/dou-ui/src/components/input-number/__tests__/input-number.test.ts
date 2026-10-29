import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouConfigProvider, DouForm, DouFormItem, DouInputNumber, en } from '../../../index'
import type { InputNumberProps } from '../../../index'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function setup(props: InputNumberProps = {}) {
  const wrapper = mount(DouInputNumber, {
    props: {
      ...props,
      'onUpdate:modelValue': (value: number | null) => wrapper.setProps({ modelValue: value }),
    },
    attachTo: document.body,
  })
  return { wrapper, input: wrapper.get('input') }
}

// The pad spans y 0..100, so its middle is at 50.
function touch(wrapper: ReturnType<typeof setup>['wrapper']) {
  const keys = wrapper.get('.dou-input-number__keys').element as HTMLElement
  keys.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect
  const fire = (type: string, clientY: number) => {
    keys.dispatchEvent(
      Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        pointerType: 'touch',
        pointerId: 1,
        button: 0,
        clientY,
      }),
    )
    return wrapper.vm.$nextTick()
  }
  return {
    down: (y: number) => fire('pointerdown', y),
    move: (y: number) => fire('pointermove', y),
    up: (y: number) => fire('pointerup', y),
  }
}

describe('DouInputNumber', () => {
  it('renders a spin button with the value', () => {
    const { input } = setup({ modelValue: 5, min: 0, max: 10 })
    expect(input.attributes('role')).toBe('spinbutton')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.element.value).toBe('5')
    expect(input.attributes('aria-valuenow')).toBe('5')
    expect(input.attributes('aria-valuemin')).toBe('0')
    expect(input.attributes('aria-valuemax')).toBe('10')
  })

  it('leaves the bounds out of ARIA when there are none', () => {
    const { input } = setup()
    expect(input.attributes('aria-valuemin')).toBeUndefined()
    expect(input.attributes('aria-valuenow')).toBeUndefined()
    expect(input.element.value).toBe('')
  })

  it('steps with the buttons and stops at the limits', async () => {
    const { wrapper } = setup({ modelValue: 9, max: 10 })
    await wrapper.get('.dou-input-number__increase').trigger('pointerdown', { button: 0 })
    expect(wrapper.props('modelValue')).toBe(10)
    expect(wrapper.emitted('change')?.at(-1)).toEqual([10, 9])
    expect(wrapper.get('.dou-input-number__increase').attributes('disabled')).toBeDefined()
    await wrapper.get('.dou-input-number__decrease').trigger('pointerdown', { button: 0 })
    expect(wrapper.props('modelValue')).toBe(9)
  })

  it('repeats the step while a button is held', async () => {
    vi.useFakeTimers()
    const { wrapper } = setup({ modelValue: 0 })
    await wrapper.get('.dou-input-number__increase').trigger('pointerdown', { button: 0 })
    // one step on press, one after 400ms, then one every 50ms
    await vi.advanceTimersByTimeAsync(400 + 50 * 3)
    expect(wrapper.props('modelValue')).toBe(5)
    window.dispatchEvent(new Event('pointerup'))
    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.props('modelValue')).toBe(5)
  })

  describe('on touch', () => {
    it('enlarges the keys on the first press without stepping', async () => {
      const { wrapper } = setup({ modelValue: 5 })
      const pad = touch(wrapper)
      await pad.down(10)
      expect(wrapper.classes()).toContain('is-expanded')
      expect(wrapper.props('modelValue')).toBe(5)
      await pad.up(10)
      expect(wrapper.props('modelValue')).toBe(5)
    })

    it('steps while the finger slides onto a key and stays down', async () => {
      vi.useFakeTimers()
      const { wrapper } = setup({ modelValue: 5 })
      const pad = touch(wrapper)
      await pad.down(50)
      await pad.move(20)
      expect(wrapper.props('modelValue')).toBe(6)
      await vi.advanceTimersByTimeAsync(400 + 50)
      expect(wrapper.props('modelValue')).toBe(8)
      // sliding to the other key reverses
      await pad.move(80)
      expect(wrapper.props('modelValue')).toBe(7)
      await pad.up(80)
      // lifting ends the adjustment and shrinks the pad at once
      expect(wrapper.classes()).not.toContain('is-expanded')
      await vi.advanceTimersByTimeAsync(500)
      expect(wrapper.props('modelValue')).toBe(7)
    })

    it('steps on taps once enlarged', async () => {
      const { wrapper } = setup({ modelValue: 5 })
      const pad = touch(wrapper)
      await pad.down(10)
      await pad.up(10)
      await pad.down(10)
      await pad.up(10)
      expect(wrapper.props('modelValue')).toBe(6)
      await pad.down(90)
      await pad.up(90)
      expect(wrapper.props('modelValue')).toBe(5)
    })

    it('shrinks back after a tap elsewhere or a pause', async () => {
      vi.useFakeTimers()
      const { wrapper } = setup({ modelValue: 5 })
      const pad = touch(wrapper)
      await pad.down(50)
      await pad.up(50)
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(wrapper.classes()).not.toContain('is-expanded')
      await pad.down(50)
      await pad.up(50)
      await vi.advanceTimersByTimeAsync(1900)
      expect(wrapper.classes()).toContain('is-expanded')
      await vi.advanceTimersByTimeAsync(200)
      expect(wrapper.classes()).not.toContain('is-expanded')
    })

    it('does not enlarge when readonly', async () => {
      const { wrapper } = setup({ modelValue: 5, readonly: true })
      await touch(wrapper).down(10)
      expect(wrapper.classes()).not.toContain('is-expanded')
    })
  })

  it('steps with the keyboard', async () => {
    const { wrapper, input } = setup({ modelValue: 50, min: 0, max: 100, step: 2 })
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.props('modelValue')).toBe(52)
    await input.trigger('keydown', { key: 'PageDown' })
    expect(wrapper.props('modelValue')).toBe(32)
    await input.trigger('keydown', { key: 'Home' })
    expect(wrapper.props('modelValue')).toBe(0)
    await input.trigger('keydown', { key: 'End' })
    expect(wrapper.props('modelValue')).toBe(100)
  })

  it('steps decimals without floating point noise', async () => {
    const { wrapper, input } = setup({ modelValue: 0.1, step: 0.2 })
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.props('modelValue')).toBe(0.3)
    expect(input.element.value).toBe('0.3')
  })

  it('rounds to and shows the precision', async () => {
    const { wrapper, input } = setup({ modelValue: 1, precision: 2 })
    expect(input.element.value).toBe('1.00')
    await input.setValue('1.005')
    await input.trigger('blur')
    expect(wrapper.props('modelValue')).toBe(1.01)
    expect(input.element.value).toBe('1.01')
  })

  it('reports typed values in range and clamps the rest on commit', async () => {
    const { wrapper, input } = setup({ modelValue: 1, min: 0, max: 10 })
    await input.setValue('7')
    expect(wrapper.props('modelValue')).toBe(7)
    expect(wrapper.emitted('change')).toBeUndefined()
    await input.setValue('70')
    expect(wrapper.props('modelValue')).toBe(7)
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('modelValue')).toBe(10)
    expect(input.element.value).toBe('10')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([10, 1])
  })

  it('keeps partial input while typing and restores the value for garbage', async () => {
    const { wrapper, input } = setup({ modelValue: 3 })
    await input.setValue('-')
    expect(input.element.value).toBe('-')
    expect(wrapper.props('modelValue')).toBe(3)
    await input.setValue('abc')
    await input.trigger('blur')
    expect(input.element.value).toBe('3')
    expect(wrapper.props('modelValue')).toBe(3)
  })

  it('accepts full-width digits', async () => {
    const { wrapper, input } = setup()
    await input.setValue('１２．５')
    await input.trigger('blur')
    expect(wrapper.props('modelValue')).toBe(12.5)
  })

  it('empties to null', async () => {
    const { wrapper, input } = setup({ modelValue: 3 })
    await input.setValue('')
    await input.trigger('blur')
    expect(wrapper.props('modelValue')).toBeNull()
    expect(wrapper.emitted('change')?.at(-1)).toEqual([null, 3])
  })

  it('follows changes from outside', async () => {
    const { wrapper, input } = setup({ modelValue: 3 })
    await wrapper.setProps({ modelValue: 8 })
    expect(input.element.value).toBe('8')
  })

  it('does not step when disabled or readonly', async () => {
    const { wrapper, input } = setup({ modelValue: 3, readonly: true })
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.props('modelValue')).toBe(3)
    expect(wrapper.get('.dou-input-number__increase').attributes('disabled')).toBeDefined()
  })

  it('hides the buttons without controls', () => {
    const { wrapper } = setup({ controls: false })
    expect(wrapper.find('.dou-input-number__controls').exists()).toBe(false)
  })

  it('labels the buttons from the locale', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { locale: en },
      slots: { default: () => h(DouInputNumber) },
    })
    expect(wrapper.get('.dou-input-number__increase').attributes('aria-label')).toBe('Increase')
    expect(wrapper.get('.dou-input-number__decrease').attributes('aria-label')).toBe('Decrease')
    const zh = mount(DouInputNumber)
    expect(zh.get('.dou-input-number__increase').attributes('aria-label')).toBe('增加')
  })

  it('takes its id from a form item and follows the form size', () => {
    const wrapper = mount(DouForm, {
      props: { size: 'sm' },
      slots: { default: () => h(DouFormItem, { label: '数量' }, () => h(DouInputNumber)) },
    })
    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get('.dou-input-number').classes()).toContain('dou-input-number--sm')
  })
})
