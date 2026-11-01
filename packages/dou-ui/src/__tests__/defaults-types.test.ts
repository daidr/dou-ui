import { describe, expect, it } from 'vitest'
import type { ComponentDefaults } from '../index'

describe('ComponentDefaults', () => {
  it('types props per component', () => {
    const defaults: ComponentDefaults = {
      DouButton: { variant: 'outline' },
      DouTable: { striped: true },
      // @ts-expect-error not a button variant
      DouSwitch: { size: 'huge' },
    }
    expect(defaults.DouButton?.variant).toBe('outline')
  })

  it('takes only props, which are what defaults can fill', () => {
    const defaults: ComponentDefaults = {
      // @ts-expect-error aria-* goes to the element, not to a prop
      DouButton: { 'aria-label': 'x' },
      // @ts-expect-error data-* neither
      DouCard: { 'data-x': 1 },
      // @ts-expect-error a generic component's forwarded attributes are not props
      DouCheckbox: { autofocus: true },
      // @ts-expect-error nor its class
      DouTable: { class: 'x' },
    }
    const forwarded: ComponentDefaults = {
      // @ts-expect-error what a component passes on to its element is not a prop either
      DouInput: { placeholder: 'x' },
      // @ts-expect-error
      DouButton: { autofocus: true },
      // @ts-expect-error
      DouLink: { target: '_blank' },
      // @ts-expect-error
      DouTag: { id: 'x' },
    }
    // @ts-expect-error nor a native listener
    const listener: ComponentDefaults = { DouInput: { onKeydown: () => {} } }
    const own: ComponentDefaults = { DouInput: { clearable: true }, DouLink: { external: true } }
    const generic: ComponentDefaults = {
      DouCheckbox: { indeterminate: true },
      DouSwitch: { size: 'sm' },
    }
    expect([defaults, forwarded, listener]).toHaveLength(3)
    expect(own.DouInput?.clearable).toBe(true)
    expect(generic.DouSwitch?.size).toBe('sm')
  })
})
