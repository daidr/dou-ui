import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouSheet, emptyWorkbook } from '../index'

describe('bordered', () => {
  it('frames the sheet by default and drops the frame with bordered=false', () => {
    const modelValue = emptyWorkbook()
    expect(mount(DouSheet, { props: { modelValue } }).classes()).toContain('is-bordered')
    const bare = mount(DouSheet, { props: { modelValue, bordered: false } })
    expect(bare.classes()).not.toContain('is-bordered')
  })
})
