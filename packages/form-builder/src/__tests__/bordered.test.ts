import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { emptyDocument } from '../core/document'
import { DouFormBuilder } from '../index'

describe('bordered', () => {
  it('frames the builder by default and drops the frame with bordered=false', () => {
    const modelValue = emptyDocument()
    expect(mount(DouFormBuilder, { props: { modelValue } }).classes()).toContain('is-bordered')
    expect(
      mount(DouFormBuilder, { props: { modelValue, bordered: false } }).classes(),
    ).not.toContain('is-bordered')
  })
})
