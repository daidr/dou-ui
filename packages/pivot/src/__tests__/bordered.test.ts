import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouPivot } from '../index'

const data = [{ city: '上海', amount: 1 }]
const config = { rows: ['city'], values: ['amount'] }

describe('bordered', () => {
  it('frames the table by default and drops the frame with bordered=false', () => {
    expect(mount(DouPivot, { props: { data, config } }).classes()).toContain('is-bordered')
    const bare = mount(DouPivot, { props: { data, config, bordered: false } })
    expect(bare.classes()).not.toContain('is-bordered')
  })
})
