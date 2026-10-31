import type { SheetValue } from './model'

/*
 * Continuing a run of values, as dragging the fill handle does: numbers by
 * their trend, dates by days or months, times by hours, text ending in a
 * number ("第 1 周") by that number; anything else repeats.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})$/
const NUMBERED = /^(.*?)(\d+)(\D*)$/

type Kind =
  | { kind: 'number'; n: number }
  | { kind: 'date'; day: number }
  | { kind: 'time'; minute: number }
  | { kind: 'numbered'; before: string; n: number; width: number; after: string }
  | { kind: 'other' }

const DAY = 86_400_000

function kindOf(value: SheetValue): Kind {
  if (typeof value === 'number') return { kind: 'number', n: value }
  if (typeof value !== 'string' || value.startsWith('=')) return { kind: 'other' }
  const date = DATE.exec(value)
  if (date) return { kind: 'date', day: Date.UTC(+date[1]!, +date[2]! - 1, +date[3]!) / DAY }
  const time = TIME.exec(value)
  if (time) return { kind: 'time', minute: +time[1]! * 60 + +time[2]! }
  const numbered = NUMBERED.exec(value)
  if (numbered && (numbered[1] || numbered[3]) && numbered[2]!.length <= 15)
    return {
      kind: 'numbered',
      before: numbered[1]!,
      n: Number(numbered[2]),
      width: numbered[2]!.length,
      after: numbered[3]!,
    }
  return { kind: 'other' }
}

const round = (n: number) => Number(n.toPrecision(15))

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function dateText(day: number) {
  const date = new Date(day * DAY)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** The step between equal-spaced numbers, or `null` when they aren't. */
function evenStep(list: number[]) {
  const step = list[1]! - list[0]!
  for (let i = 2; i < list.length; i++)
    if (round(list[i]! - list[i - 1]!) !== round(step)) return null
  return step
}

/** The best straight line through the numbers, as a function of their place. */
function trend(list: number[]) {
  const n = list.length
  const even = evenStep(list)
  if (even != null) return (i: number) => round(list[n - 1]! + even * (i - n + 1))
  const meanX = (n - 1) / 2
  const meanY = list.reduce((a, b) => a + b, 0) / n
  let top = 0
  let bottom = 0
  list.forEach((y, x) => {
    top += (x - meanX) * (y - meanY)
    bottom += (x - meanX) ** 2
  })
  const slope = top / bottom
  return (i: number) => round(meanY + slope * (i - meanX))
}

/** Months between dates on the same day of the month, evenly; `null` otherwise. */
function monthStep(days: number[]) {
  const parts = days.map((day) => {
    const date = new Date(day * DAY)
    return { month: date.getUTCFullYear() * 12 + date.getUTCMonth(), date: date.getUTCDate() }
  })
  if (parts.some((part) => part.date !== parts[0]!.date)) return null
  const step = evenStep(parts.map((part) => part.month))
  return step ? { step, first: parts[0]!.month, date: parts[0]!.date } : null
}

/**
 * The `count` values that follow `values`. With `invert`, a run that would
 * continue repeats instead, and a single number counts up by one. `back`
 * says the values are in reverse (filling up or left), so a single value
 * counts down.
 */
export function continueValues(
  values: readonly SheetValue[],
  count: number,
  invert = false,
  back = false,
) {
  const one = back ? -1 : 1
  const n = values.length
  const repeat = () => Array.from({ length: count }, (_, i) => values[(n + i) % n] ?? null)
  if (n === 0 || count <= 0) return []
  const kinds = values.map(kindOf)
  const first = kinds[0]!
  const same = kinds.every((kind) => kind.kind === first.kind)
  if (!same || first.kind === 'other') return repeat()
  const after = (i: number) => n + i
  switch (first.kind) {
    case 'number': {
      const list = kinds.map((kind) => (kind as { n: number }).n)
      // one number copies; Ctrl / ⌘ counts up instead
      if (n === 1)
        return invert
          ? Array.from({ length: count }, (_, i) => round(list[0]! + one * (i + 1)))
          : repeat()
      if (invert) return repeat()
      const at = trend(list)
      return Array.from({ length: count }, (_, i) => at(after(i)))
    }
    case 'date': {
      if (invert) return repeat()
      const days = kinds.map((kind) => (kind as { day: number }).day)
      // the same day of each month goes on by months, other even steps by days
      const months = n > 1 ? monthStep(days) : null
      if (n > 1 && !months && evenStep(days) == null) return repeat()
      if (months) {
        return Array.from({ length: count }, (_, i) => {
          const month = months.first + months.step * after(i)
          const year = Math.floor(month / 12)
          const last = new Date(Date.UTC(year, (month % 12) + 1, 0)).getUTCDate()
          return `${year}-${pad((month % 12) + 1)}-${pad(Math.min(months.date, last))}`
        })
      }
      const step = n === 1 ? one : days[1]! - days[0]!
      return Array.from({ length: count }, (_, i) => dateText(days[n - 1]! + step * (i + 1)))
    }
    case 'time': {
      if (invert) return repeat()
      const minutes = kinds.map((kind) => (kind as { minute: number }).minute)
      const step = n === 1 ? 60 * one : evenStep(minutes)
      if (step == null) return repeat()
      return Array.from({ length: count }, (_, i) => {
        const m = (((minutes[n - 1]! + step * (i + 1)) % 1440) + 1440) % 1440
        return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
      })
    }
    case 'numbered': {
      if (invert) return repeat()
      const list = kinds as Extract<Kind, { kind: 'numbered' }>[]
      if (list.some((kind) => kind.before !== first.before || kind.after !== first.after))
        return repeat()
      const numbers = list.map((kind) => kind.n)
      const step = n === 1 ? one : evenStep(numbers)
      if (step == null) return repeat()
      return Array.from({ length: count }, (_, i) => {
        const value = Math.max(0, numbers[n - 1]! + step * (i + 1))
        return `${first.before}${String(value).padStart(first.width, '0')}${first.after}`
      })
    }
  }
}
