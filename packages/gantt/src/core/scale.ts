import { MINUTES_PER_DAY, MINUTES_PER_HOUR, dayStart, fromParts, partsOf } from './time'

export type GanttScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

/** A step of the time header. */
export type TimeUnit = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

export interface ScaleLevel {
  name: GanttScale
  /** The narrowest a day gets at this level, in px; below it the next level takes over. */
  min: number
  /** How wide a day is when the level is picked, in px. */
  base: number
  /** The two rows of the header. */
  top: TimeUnit
  bottom: TimeUnit
}

/** From the widest days to the narrowest. */
export const scaleLevels: readonly ScaleLevel[] = [
  { name: 'hour', min: 288, base: 960, top: 'day', bottom: 'hour' },
  { name: 'day', min: 24, base: 40, top: 'month', bottom: 'day' },
  { name: 'week', min: 8, base: 16, top: 'month', bottom: 'week' },
  { name: 'month', min: 2, base: 4, top: 'year', bottom: 'month' },
  { name: 'quarter', min: 0.6, base: 1.2, top: 'year', bottom: 'quarter' },
  { name: 'year', min: 0, base: 0.32, top: 'year', bottom: 'half' },
]

/** The widest and narrowest a day may be, in px. */
export const DAY_WIDTH_RANGE: [number, number] = [0.16, 2880]

export const levelByName = (name: GanttScale) =>
  scaleLevels.find((level) => level.name === name) ?? scaleLevels[1]!

/** The level that shows days `dayWidth` px wide. */
export const levelOf = (dayWidth: number) =>
  scaleLevels.find((level) => dayWidth >= level.min) ?? scaleLevels[scaleLevels.length - 1]!

/** Hours per header cell, so that labels have room. */
export function hourStep(dayWidth: number) {
  const hour = dayWidth / 24
  return [1, 2, 3, 4, 6, 12].find((step) => step * hour >= 40) ?? 12
}

/** The step that drags and new dates snap to, in minutes. */
export function snapStep(dayWidth: number) {
  if (dayWidth < scaleLevels[0]!.min) return MINUTES_PER_DAY
  const hour = dayWidth / 24
  return hour >= 80 ? 15 : hour >= 40 ? 30 : MINUTES_PER_HOUR
}

/** The start of the `unit` that holds `at`. */
export function unitStart(unit: TimeUnit, at: number, weekStart: 0 | 1 = 1, step = 1) {
  switch (unit) {
    case 'hour': {
      const hours = Math.floor(at / MINUTES_PER_HOUR)
      return (hours - ((((hours % 24) % step) + step) % step)) * MINUTES_PER_HOUR
    }
    case 'day':
      return dayStart(at)
    case 'week': {
      const { weekday } = partsOf(at)
      return dayStart(at) - ((weekday - weekStart + 7) % 7) * MINUTES_PER_DAY
    }
    default: {
      const { year, month } = partsOf(at)
      if (unit === 'year') return fromParts(year, 1, 1)
      const months = unit === 'month' ? 1 : unit === 'quarter' ? 3 : 6
      return fromParts(year, month - ((month - 1) % months), 1)
    }
  }
}

/** The start of the `unit` after the one that starts at `at`. */
export function nextUnit(unit: TimeUnit, at: number, step = 1) {
  switch (unit) {
    case 'hour':
      return at + step * MINUTES_PER_HOUR
    case 'day':
      return at + MINUTES_PER_DAY
    case 'week':
      return at + 7 * MINUTES_PER_DAY
    default: {
      const { year, month } = partsOf(at)
      const months = unit === 'month' ? 1 : unit === 'quarter' ? 3 : unit === 'half' ? 6 : 12
      return fromParts(year, month + months, 1)
    }
  }
}

/** The units that overlap `[from, to)`, as their start and end. */
export function unitsBetween(
  unit: TimeUnit,
  from: number,
  to: number,
  weekStart: 0 | 1 = 1,
  step = 1,
) {
  const out: { start: number; end: number }[] = []
  for (let at = unitStart(unit, from, weekStart, step); at < to;) {
    const next = nextUnit(unit, at, step)
    out.push({ start: at, end: next })
    at = next
  }
  return out
}
