import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouCalendarHeatmap } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const range = { start: '2026-10-01', end: '2026-10-31' }
const data = [
  { date: '2026-10-05', value: 2 },
  { date: '2026-10-05', value: 2 },
  { date: '2026-10-12', value: 8 },
  { date: '2026-10-20', value: 1 },
]

describe('DouCalendarHeatmap', () => {
  it('renders one cell per day, summing values and shading them', () => {
    const wrapper = mount(DouCalendarHeatmap, { props: { ...range, data } })
    const cells = wrapper.findAll('[role="gridcell"]')
    expect(cells).toHaveLength(31)
    const level = (date: string) => wrapper.get(`[data-date="${date}"]`).attributes('data-level')
    expect(level('2026-10-01')).toBe('0')
    expect(level('2026-10-05')).toBe('2') // 4 of 8
    expect(level('2026-10-12')).toBe('4')
    expect(level('2026-10-20')).toBe('1')
    expect(wrapper.get('[data-date="2026-10-05"]').attributes('aria-label')).toBe('2026-10-05：4')
  })

  it('uses thresholds when given', () => {
    const wrapper = mount(DouCalendarHeatmap, { props: { ...range, data, thresholds: [1, 5] } })
    expect(wrapper.get('[data-date="2026-10-05"]').attributes('data-level')).toBe('1')
    expect(wrapper.get('[data-date="2026-10-12"]').attributes('data-level')).toBe('2')
    expect(wrapper.findAll('.dou-calendar-heatmap__swatch')).toHaveLength(3)
  })

  it('lays out weeks as columns starting on the week start', () => {
    // 2026-10-01 is a Thursday
    const monday = mount(DouCalendarHeatmap, { props: { ...range, weekStart: 1 } })
    const style = (date: string) => monday.get(`[data-date="${date}"]`).attributes('style')
    expect(style('2026-10-01')).toContain('grid-row: 5')
    expect(style('2026-10-01')).toContain('grid-column: 2')
    // Monday the 5th starts the next column
    expect(style('2026-10-05')).toContain('grid-row: 2')
    expect(style('2026-10-05')).toContain('grid-column: 3')
  })

  it('moves with the arrow keys, keeps one tab stop and selects with Enter', async () => {
    const wrapper = mount(DouCalendarHeatmap, {
      props: { ...range, data },
      attachTo: document.body,
    })
    const focusable = () => wrapper.findAll('[tabindex="0"]')
    expect(focusable()).toHaveLength(1)
    expect(focusable()[0]!.attributes('data-date')).toBe('2026-10-31')

    const start = wrapper.get('[data-date="2026-10-12"]')
    ;(start.element as HTMLElement).focus()
    await start.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-10-05')
    await wrapper.get('[data-date="2026-10-05"]').trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-10-04')
    await wrapper.get('[data-date="2026-10-04"]').trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-10-01')
    await wrapper.get('[data-date="2026-10-01"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toEqual([[{ date: '2026-10-01', value: 0 }]])
  })

  it('shows a tooltip for the hovered day', async () => {
    const wrapper = mount(DouCalendarHeatmap, {
      props: { ...range, data },
      attachTo: document.body,
    })
    await wrapper.get('[data-date="2026-10-12"]').trigger('pointerover')
    await nextTick()
    const tip = document.querySelector('[role="tooltip"]')
    expect(tip?.textContent).toBe('2026-10-12：8')
  })
})
