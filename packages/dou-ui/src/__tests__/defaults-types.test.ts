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
    const generic: ComponentDefaults = {
      DouCheckbox: { indeterminate: true },
      DouSwitch: { size: 'sm' },
    }
    expect(defaults).toBeTruthy()
    expect(generic.DouSwitch?.size).toBe('sm')
  })
})
