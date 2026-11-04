import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouFlowEditor } from '../index'

describe('bordered', () => {
  it('frames the canvas by default and drops the frame with bordered=false', () => {
    expect(mount(DouFlowEditor).classes()).toContain('is-bordered')
    expect(mount(DouFlowEditor, { props: { bordered: false } }).classes()).not.toContain(
      'is-bordered',
    )
  })
})
