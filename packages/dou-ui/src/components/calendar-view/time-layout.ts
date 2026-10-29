import type { CalendarEvent } from './calendar-view'

/** `HH:mm` as minutes since midnight, or `null`. */
export function toMinutes(time: string | undefined): number | null {
  const match = time && /^(\d{1,2}):(\d{2})/.exec(time)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 0 && minutes <= 24 * 60 ? minutes : null
}

export const isTimed = (event: CalendarEvent) => toMinutes(event.time) !== null

export interface PlacedEvent {
  event: CalendarEvent
  /** Minutes since midnight. */
  start: number
  end: number
  /** Which of the side-by-side columns it takes, from 0. */
  column: number
  /** How many columns its group of overlapping events needs. */
  columns: number
  /** How many columns it covers, widening into free columns on its right. */
  span: number
}

/**
 * Lay out one day's timed events. Events that overlap, directly or through
 * others, form a group; each takes the leftmost column free at its start,
 * and the whole group shares the width between its columns. An event then
 * widens to the right over columns that stay free for its whole time.
 */
export function layoutDay(events: CalendarEvent[]): PlacedEvent[] {
  const placed: PlacedEvent[] = events.map((event) => {
    const start = toMinutes(event.time)!
    const end = Math.max(toMinutes(event.endTime) ?? start + 60, start + 15)
    return { event, start, end: Math.min(end, 24 * 60), column: 0, columns: 1, span: 1 }
  })
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  placed.sort((a, b) => a.start - b.start || b.end - a.end)

  let group: PlacedEvent[] = []
  let ends: number[] = []
  let groupEnd = -1
  const overlaps = (a: PlacedEvent, b: PlacedEvent) => a.start < b.end && b.start < a.end
  const close = () => {
    for (const item of group) {
      item.columns = ends.length
      let next = item.column + 1
      while (
        next < ends.length &&
        !group.some((other) => other.column === next && overlaps(item, other))
      )
        next++
      item.span = next - item.column
    }
    group = []
    ends = []
  }
  for (const item of placed) {
    if (item.start >= groupEnd) close()
    let column = ends.findIndex((end) => end <= item.start)
    if (column < 0) column = ends.push(item.end) - 1
    else ends[column] = item.end
    item.column = column
    group.push(item)
    groupEnd = Math.max(groupEnd, item.end)
  }
  close()
  return placed
}
