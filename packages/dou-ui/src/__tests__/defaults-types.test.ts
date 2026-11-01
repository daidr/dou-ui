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
})
