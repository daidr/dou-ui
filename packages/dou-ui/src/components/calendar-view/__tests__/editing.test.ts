import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouCalendarView } from '../../../index'
import type { CalendarEvent } from '../calendar-view'
import { endOf, formatStamp, moveEvent, toStamp } from '../editing'
import { spanOf } from '../time-layout'

const move = (event: CalendarEvent, by: { days?: number; minutes?: number }) =>
  moveEvent(event, spanOf(event)!, by)

describe('moveEvent', () => {
  it('moves timed events by minutes across midnight, writing end only when it was there', () => {
    const event = { id: 'a', title: 'a', start: '2026-10-28 23:30', end: '2026-10-29 00:30' }
    expect(move(event, { minutes: 45 })).toMatchObject({
      start: '2026-10-29 00:15',
      end: '2026-10-29 01:15',
    })
    const short = { id: 'b', title: 'b', start: '2026-10-28 09:00' }
    const moved = move(short, { days: 1 })
    expect(moved).toEqual({ id: 'b', title: 'b', start: '2026-10-29 09:00' })
    expect(endOf(moved)).toBe('2026-10-29 10:00')
  })

  it('keeps all-day events whole and their end as written', () => {
    const event = { id: 'a', title: 'a', start: '2026-10-30', end: '2026-11-01 00:00' }
    expect(move(event, { days: 3 })).toMatchObject({
      start: '2026-11-02',
      end: '2026-11-04 00:00',
    })
    expect(endOf(move(event, { days: 3 }))).toBe('2026-11-03')
  })

  it('reads and writes stamps on a calendar without time zones', () => {
    expect(formatStamp(toStamp('2026-03-29', 0) + 24 * 60)).toBe('2026-03-30 00:00')
    expect(formatStamp(toStamp('2024-02-28', 23 * 60 + 59) + 1)).toBe('2024-02-29 00:00')
  })
})

const EVENTS: CalendarEvent[] = [
  { id: 'a', title: '评审', start: '2026-10-28 09:00', end: '2026-10-28 10:00' },
  { id: 'b', title: '出差', start: '2026-10-26', end: '2026-10-27' },
  { id: 'c', title: '大会', start: '2026-10-27 14:00', end: '2026-10-27 15:00', locked: true },
]

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

function make(props: Record<string, unknown> = {}) {
  const w: VueWrapper = mount(DouCalendarView, {
    props: {
      modelValue: '2026-10-28',
      view: 'week',
      editable: true,
      events: EVENTS,
      'onUpdate:events': (events: CalendarEvent[]) => w.setProps({ events }),
      ...props,
    },
    attachTo: document.body,
  })
  wrapper = w
  return w
}
const events = (w: VueWrapper) => (w.props() as { events: CalendarEvent[] }).events
const chip = (w: VueWrapper, id: string) => w.get(`[data-event-id="${id}"]`)

/** Lays the week's time columns out side by side, 100px wide and 24 hours of 48px. */
function layOut(w: VueWrapper) {
  w.findAll('[data-drop="time"]').forEach((column, index) => {
    vi.spyOn(column.element, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100 + index * 100, 0, 100, 24 * 48),
    )
  })
}
const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    clientX: x,
    clientY: y,
    button: 0,
    pointerId: 1,
    bubbles: true,
    pointerType: 'mouse',
  })

const touch = (type: string) =>
  new PointerEvent(type, {
    clientX: 20,
    clientY: 20,
    button: 0,
    pointerId: 2,
    bubbles: true,
    pointerType: 'touch',
  })

describe('DouCalendarView editing', () => {
  it('moves an event to another day and time by dragging', async () => {
    const w = make()
    const onChange = vi.fn<(change: unknown) => void>()
    await w.setProps({ onChange })
    layOut(w)
    // 9:00 on Wednesday, the third column
    chip(w, 'a').element.dispatchEvent(pointer('pointerdown', 350, 9 * 48 + 10))
    window.dispatchEvent(pointer('pointermove', 360, 9 * 48 + 20))
    window.dispatchEvent(pointer('pointermove', 450, 10.5 * 48 + 10))
    await nextTick()
    expect(w.get('.dou-calendar-view__tip').text()).toContain('10:30')
    // within the same slot the tip still follows the pointer
    window.dispatchEvent(pointer('pointermove', 452, 10.5 * 48 + 12))
    await nextTick()
    expect(w.get('.dou-calendar-view__tip').attributes('style')).toContain('left: 464px')
    window.dispatchEvent(pointer('pointerup', 450, 10.5 * 48 + 10))
    await nextTick()
    expect(events(w)[0]).toMatchObject({ start: '2026-10-29 10:30', end: '2026-10-29 11:30' })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'move', previous: EVENTS[0] }),
    )
  })

  it('draws a new stretch of time, snapped, and leaves adding it to the app', async () => {
    const w = make()
    const onCreate = vi.fn<(range: unknown) => void>()
    await w.setProps({ onCreate })
    layOut(w)
    const column = w.findAll('[data-drop="time"]')[4]!.element
    column.dispatchEvent(pointer('pointerdown', 550, 13 * 48 + 5))
    window.dispatchEvent(pointer('pointermove', 550, 14 * 48 + 30))
    await nextTick()
    expect(w.find('.dou-calendar-view__drawing').exists()).toBe(true)
    window.dispatchEvent(pointer('pointerup', 550, 14 * 48 + 30))
    expect(onCreate).toHaveBeenCalledWith({ start: '2026-10-30 13:00', end: '2026-10-30 14:45' })
    expect(events(w)).toHaveLength(3)
  })

  it('refuses what canMove refuses, with its reason', async () => {
    const canMove = vi.fn<(move: unknown, events: unknown) => string>(() => '只能在上午')
    const w = make({ canMove })
    layOut(w)
    chip(w, 'a').element.dispatchEvent(pointer('pointerdown', 350, 9 * 48 + 10))
    window.dispatchEvent(pointer('pointermove', 350, 15 * 48))
    await nextTick()
    expect(chip(w, 'a').classes()).toContain('is-refused')
    expect(w.get('.dou-calendar-view__tip').text()).toBe('只能在上午')
    window.dispatchEvent(pointer('pointerup', 350, 15 * 48))
    expect(events(w)[0]).toEqual(EVENTS[0])
    // the press was 12 minutes into the hour, so the event lands at 14:45
    expect(canMove).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'move', start: '2026-10-28 14:45', end: '2026-10-28 15:45' }),
      expect.any(Array),
    )
  })

  it('cancels a drag with Escape and leaves locked events alone', async () => {
    const w = make()
    layOut(w)
    chip(w, 'a').element.dispatchEvent(pointer('pointerdown', 350, 9 * 48 + 10))
    window.dispatchEvent(pointer('pointermove', 350, 12 * 48))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(pointer('pointerup', 350, 12 * 48))
    expect(events(w)[0]).toEqual(EVENTS[0])

    chip(w, 'c').element.dispatchEvent(pointer('pointerdown', 250, 14 * 48 + 10))
    window.dispatchEvent(pointer('pointermove', 250, 17 * 48))
    window.dispatchEvent(pointer('pointerup', 250, 17 * 48))
    expect(events(w)[2]).toEqual(EVENTS[2])
  })

  it('moves, resizes and removes with keys, reading out the result', async () => {
    const w = make()
    await chip(w, 'a').trigger('keydown', { key: 'ArrowDown', altKey: true })
    expect(events(w)[0]).toMatchObject({ start: '2026-10-28 09:15', end: '2026-10-28 10:15' })
    await nextTick()
    expect(w.get('.dou-calendar-view__live').text()).toContain('评审')
    await chip(w, 'a').trigger('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true })
    expect(events(w)[0]).toMatchObject({ start: '2026-10-28 09:15', end: '2026-10-28 10:30' })
    await chip(w, 'b').trigger('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true })
    expect(events(w)[1]).toMatchObject({ start: '2026-10-26', end: '2026-10-28' })
    await chip(w, 'c').trigger('keydown', { key: 'Delete' })
    expect(events(w)).toHaveLength(3)
    await chip(w, 'a').trigger('keydown', { key: 'Delete' })
    expect(events(w).map((event) => event.id)).toEqual(['b', 'c'])
  })

  it('refuses days of disabledDate', async () => {
    const w = make({ disabledDate: (date: string) => date === '2026-10-29' })
    await chip(w, 'a').trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(events(w)[0]).toEqual(EVENTS[0])
    expect(w.get('.dou-calendar-view__live').text()).toBe('这天不可选')
  })

  it('opens a menu with your items before the built-in delete', async () => {
    const run = vi.fn<() => void>()
    const onEventContextmenu = vi.fn<(...args: unknown[]) => void>()
    const w = make({
      contextMenu: (target: { kind: string }) =>
        target.kind === 'event' ? [{ key: 'x', label: '详情', run }] : [],
      onEventContextmenu,
    })
    await chip(w, 'a').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await nextTick()
    expect(onEventContextmenu).toHaveBeenCalled()
    const items = document.querySelectorAll('[role="menuitem"]')
    expect([...items].map((item) => item.textContent?.trim())).toEqual(['详情', '删除日程Delete'])
    ;(items[1] as HTMLElement).click()
    await nextTick()
    expect(events(w).map((event) => event.id)).toEqual(['b', 'c'])
  })

  it('does nothing to events unless editable', async () => {
    const w = make({ editable: false })
    layOut(w)
    expect(w.find('[data-resize]').exists()).toBe(false)
    chip(w, 'a').element.dispatchEvent(pointer('pointerdown', 350, 9 * 48 + 10))
    window.dispatchEvent(pointer('pointermove', 350, 12 * 48))
    window.dispatchEvent(pointer('pointerup', 350, 12 * 48))
    await chip(w, 'a').trigger('keydown', { key: 'Delete' })
    expect(events(w)).toEqual(EVENTS)
  })

  it('keeps the keyboard near after a delete', async () => {
    const w = make({
      events: [
        ...EVENTS,
        { id: 'd', title: '周会', start: '2026-10-28 11:00', end: '2026-10-28 12:00' },
      ],
    })
    ;(chip(w, 'a').element as HTMLElement).focus()
    await chip(w, 'a').trigger('keydown', { key: 'Delete' })
    await nextTick()
    expect((document.activeElement as HTMLElement).dataset.eventId).toBe('d')
    await chip(w, 'd').trigger('keydown', { key: 'Backspace' })
    await nextTick()
    await nextTick()
    expect((document.activeElement as HTMLElement).dataset.date).toBe('2026-10-28')
  })

  it('sends eventContextmenu for the menu key too, and lets it keep the menu closed', async () => {
    const onEventContextmenu = vi.fn<(event: CalendarEvent, native: MouseEvent) => void>(
      (_event, native) => native.preventDefault(),
    )
    const w = make({ onEventContextmenu })
    await chip(w, 'a').trigger('keydown', { key: 'F10', shiftKey: true })
    await nextTick()
    expect(onEventContextmenu).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="menuitem"]')).toBeNull()
  })

  it('keeps moves inside the hours shown and rounds clicks to snap', async () => {
    const onTimeClick = vi.fn<(start: string) => void>()
    const w = make({
      hours: [9, 20],
      onTimeClick,
      events: [{ id: 'a', title: '评审', start: '2026-10-28 09:00', end: '2026-10-28 10:00' }],
    })
    await chip(w, 'a').trigger('keydown', { key: 'ArrowUp', altKey: true })
    expect(events(w)[0]!.start).toBe('2026-10-28 09:00')
    for (let i = 0; i < 50; i++)
      await chip(w, 'a').trigger('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true })
    expect(events(w)[0]!.end).toBe('2026-10-28 20:00')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 11 * 48),
    )
    // 48px an hour: 60px is 10:15 from the top of a 9:00 axis
    await w.findAll('[data-drop="time"]')[2]!.trigger('click', { clientY: 60 })
    expect(onTimeClick).toHaveBeenCalledWith('2026-10-28 10:15')
    vi.restoreAllMocks()
  })

  it('warns once when nothing receives the changes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    wrapper = mount(DouCalendarView, { props: { editable: true, events: EVENTS } })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('v-model:events'))
    warn.mockRestore()
  })

  it('lists the month by day in the agenda, and edits from there too', async () => {
    const onEventClick = vi.fn<(event: CalendarEvent) => void>()
    const w = make({ view: 'agenda', onEventClick })
    const days = w.findAll('.dou-calendar-view__agenda-day')
    expect(days.map((day) => day.attributes('data-agenda-date'))).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ])
    expect(days[1]!.findAll('.dou-calendar-view__agenda-event').map((el) => el.text())).toEqual([
      '全天出差',
      '14:00–15:00大会',
    ])
    await chip(w, 'a').trigger('click')
    expect(onEventClick).toHaveBeenCalledWith(EVENTS[0])
    await chip(w, 'a').trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(events(w)[0]).toMatchObject({ start: '2026-10-29 09:00' })
    await w.setProps({ events: [] })
    expect(w.get('.dou-calendar-view__agenda-empty').text()).toBe('这个月没有日程')
  })

  it('opens the menu on an agenda event after a finger rests on it', async () => {
    vi.useFakeTimers()
    try {
      const w = make({ view: 'agenda' })
      chip(w, 'a').element.dispatchEvent(touch('pointerdown'))
      // the browser's own long-press menu is kept back
      const native = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      chip(w, 'a').element.dispatchEvent(native)
      expect(native.defaultPrevented).toBe(true)
      vi.advanceTimersByTime(400)
      window.dispatchEvent(touch('pointerup'))
      await nextTick()
      expect(
        [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent),
      ).toEqual([expect.stringContaining('删除日程')])
    } finally {
      vi.useRealTimers()
    }
  })

  it('moves focus to the next day when the last event of an agenda day goes', async () => {
    const w = make({ view: 'agenda' })
    ;(chip(w, 'a').element as HTMLElement).focus()
    await chip(w, 'a').trigger('keydown', { key: 'Delete' })
    await nextTick()
    await nextTick()
    // the 28th is gone; the 27th is the day before, its first event takes the keyboard
    expect(document.activeElement?.getAttribute('data-event-id')).toBe('b')
  })

  it('leaves up and down alone in the agenda', async () => {
    const w = make({ view: 'agenda' })
    expect(chip(w, 'a').attributes('aria-keyshortcuts')).not.toContain('ArrowUp')
    await chip(w, 'a').trigger('keydown', { key: 'ArrowDown', altKey: true })
    await chip(w, 'a').trigger('keydown', { key: 'ArrowDown', altKey: true, shiftKey: true })
    expect(events(w)).toEqual(EVENTS)
  })

  it('puts the keyboard on the new day when the app stores a change under a new id', async () => {
    const w = make({
      view: 'month',
      'onUpdate:events': (list: CalendarEvent[]) =>
        w.setProps({
          events: list.map((event) => (event.id === 'a' ? { ...event, id: 'a-2' } : event)),
        }),
    })
    ;(chip(w, 'a').element as HTMLElement).focus()
    await chip(w, 'a').trigger('keydown', { key: 'ArrowRight', altKey: true })
    await nextTick()
    await nextTick()
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-10-29')
  })

  it('tells which days are on screen', async () => {
    const onRangeChange = vi.fn<(range: { start: string; end: string }) => void>()
    const w = make({ view: 'month', onRangeChange, weekStart: 1 })
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: '2026-09-28', end: '2026-11-08' })
    await w.setProps({ view: 'week' })
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: '2026-10-26', end: '2026-11-01' })
    await w.setProps({ view: 'agenda' })
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: '2026-10-01', end: '2026-10-31' })
    await w.setProps({ view: 'day' })
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: '2026-10-28', end: '2026-10-28' })
    expect(onRangeChange).toHaveBeenCalledTimes(4)
  })
})
