import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouSheet } from '../index'

describe('bordered', () => {
  it('frames the sheet by default and drops the frame with bordered=false', () => {
    expect(mount(DouSheet).classes()).toContain('is-bordered')
    expect(mount(DouSheet, { props: { bordered: false } }).classes()).not.toContain('is-bordered')
  })
})
