/*
 * The stretch of an axis that is shown when zoomed in: a window on the
 * axis' whole domain, in the scale's own numbers (category indices, ms on
 * a time axis). Kept apart from the chart so it can be tested alone.
 */
import { toTime, type XKind } from './data'
import type { ChartTickValue } from './layout'
import type { Scale } from './scale'

export type Window = [number, number]

/** Turns a value as given (a category, a date, a number) into the scale's number; `NaN` if it can't be. */
export function valueToNumber(value: ChartTickValue, kind: XKind, categories: string[]): number {
  if (kind === 'category') {
    const at = categories.indexOf(String(value))
    return at < 0 ? Number.NaN : at
  }
  if (kind === 'time') return toTime(value)
  return typeof value === 'number' ? value : Number(value)
}

/** The value as given for a scale number: the category, a `Date`, or the number. */
export function numberToValue(value: number, kind: XKind, categories: string[]): ChartTickValue {
  if (kind === 'category') return categories[value] ?? ''
  if (kind === 'time') return new Date(value)
  return value
}

/**
 * The window of an interval as given; categories take their whole step,
 * from half a step before the first to half after the last. `null` for
 * none, or one that can't be read.
 */
export function intervalToWindow(
  interval: readonly [ChartTickValue, ChartTickValue] | null | undefined,
  kind: XKind,
  categories: string[],
): Window | null {
  if (!interval) return null
  let a = valueToNumber(interval[0], kind, categories)
  let b = valueToNumber(interval[1], kind, categories)
  if (a !== a || b !== b) return null
  if (a > b) [a, b] = [b, a]
  return kind === 'category' ? [a - 0.5, b + 0.5] : a === b ? null : [a, b]
}

/** The interval of a window: for categories, the first and last mostly in it. */
export function windowToInterval(
  window: Window,
  kind: XKind,
  categories: string[],
): [ChartTickValue, ChartTickValue] {
  if (kind === 'category') {
    const [a, b] = snapCategories(window)
    return [categories[a + 0.5] ?? '', categories[b - 0.5] ?? '']
  }
  return [numberToValue(window[0], kind, categories), numberToValue(window[1], kind, categories)]
}

/** A window on categories moved to whole steps, keeping at least one. */
export function snapCategories([a, b]: Window): Window {
  let from = Math.round(a + 0.5)
  let to = Math.round(b - 0.5)
  if (to < from) {
    const middle = Math.round((a + b) / 2)
    from = to = middle
  }
  return [from - 0.5, to + 0.5]
}

/** Numbers a scale is even in: the log of a log scale's values. */
export interface Units {
  to: (value: number) => number
  from: (unit: number) => number
}

const same: Units = { to: (v) => v, from: (v) => v }
const log: Units = { to: Math.log10, from: (u) => 10 ** u }
export const unitsOf = (scale: Pick<Scale, 'kind'>): Units => (scale.kind === 'log' ? log : same)

/**
 * `window` kept inside `full`, at least `least` wide (in units): a window
 * that runs over an end is moved back, not cut. `null` when it covers
 * all of `full`.
 */
export function clampWindow(
  window: Window,
  full: Window,
  least: number,
  units: Units = same,
): Window | null {
  const f0 = units.to(full[0])
  const f1 = units.to(full[1])
  let a = units.to(Math.min(window[0], window[1]))
  let b = units.to(Math.max(window[0], window[1]))
  const span = f1 - f0
  if (!(span > 0) || a !== a || b !== b) return null
  const wanted = Math.min(span, Math.max(b - a, Math.min(least, span)))
  if (b - a < wanted) {
    const middle = (a + b) / 2
    a = middle - wanted / 2
    b = middle + wanted / 2
  }
  if (a < f0) [a, b] = [f0, f0 + (b - a)]
  if (b > f1) [a, b] = [f1 - (b - a), f1]
  a = Math.max(a, f0)
  // all of it: not zoomed
  if (b - a >= span * (1 - 1e-9)) return null
  return [units.from(a), units.from(b)]
}

/** The window `scale` shows with its range moved `by` px: dragging the plot by `-by`. */
export function panWindow(scale: Scale, by: number): Window {
  const [r0, r1] = scale.range
  return order(scale.invert(r0 + by), scale.invert(r1 + by))
}

/** The window `scale` shows zoomed by `factor` (below 1 is in) about the pixel `at`. */
export function zoomWindow(scale: Scale, at: number, factor: number): Window {
  const [r0, r1] = scale.range
  return order(scale.invert(at + (r0 - at) * factor), scale.invert(at + (r1 - at) * factor))
}

const order = (a: number, b: number): Window => (a <= b ? [a, b] : [b, a])

/** Whether `value` is at or between the ends of `window`. */
export const within = (value: number, window: Window) => value >= window[0] && value <= window[1]
