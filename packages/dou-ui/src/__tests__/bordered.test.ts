import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  DouCalendarView,
  DouCodeBlock,
  DouDescriptions,
  DouLayoutFooter,
  DouQrcode,
  DouTable,
} from '../index'

// Every framed component takes `bordered`, on by default; off, it drops the
// `is-bordered` class that the stylesheet keys the frame on.
describe('bordered', () => {
  const cases = [
    [
      'DouTable',
      () => h(DouTable, { data: [], columns: [] }),
      (b: boolean) => h(DouTable, { data: [], columns: [], bordered: b }),
    ],
    [
      'DouCodeBlock',
      () => h(DouCodeBlock, { code: 'a' }),
      (b: boolean) => h(DouCodeBlock, { code: 'a', bordered: b }),
    ],
    [
      'DouQrcode',
      () => h(DouQrcode, { value: 'a' }),
      (b: boolean) => h(DouQrcode, { value: 'a', bordered: b }),
    ],
    [
      'DouCalendarView',
      () => h(DouCalendarView, { month: '2026-11' }),
      (b: boolean) => h(DouCalendarView, { month: '2026-11', bordered: b }),
    ],
    [
      'DouLayoutFooter',
      () => h(DouLayoutFooter),
      (b: boolean) => h(DouLayoutFooter, { bordered: b }),
    ],
  ] as const

  for (const [name, plain, set] of cases) {
    it(`${name} is framed by default and drops the frame with bordered=false`, () => {
      expect(mount(plain).classes()).toContain('is-bordered')
      expect(mount(() => set(true)).classes()).toContain('is-bordered')
      expect(mount(() => set(false)).classes()).not.toContain('is-bordered')
    })
  }

  it('DouDescriptions takes its look from variant, and bordered frames the table variant', () => {
    const plain = mount(DouDescriptions)
    expect(plain.classes()).toContain('dou-descriptions--plain')
    const table = mount(DouDescriptions, { props: { variant: 'table' } })
    expect(table.classes()).toEqual(
      expect.arrayContaining(['dou-descriptions--table', 'is-bordered']),
    )
    const bare = mount(DouDescriptions, { props: { variant: 'table', bordered: false } })
    expect(bare.classes()).not.toContain('is-bordered')
  })

  it('DouTable draws column dividers only with columnDividers', () => {
    const plain = mount(DouTable, { props: { data: [], columns: [] } })
    expect(plain.classes()).not.toContain('is-column-dividers')
    const lined = mount(DouTable, { props: { data: [], columns: [], columnDividers: true } })
    expect(lined.classes()).toContain('is-column-dividers')
    expect(lined.classes()).toContain('is-bordered')
  })
})
