import { formatValue, isDateFormat, parseInput } from '../core/format'
import { DIV0, isSheetError, NA, NUM, SheetError, VALUE } from './error'
import {
  compareValues,
  dateParts,
  dateText,
  isDateText,
  isRange,
  isTimeText,
  serialOf,
  timeOrDays,
  timeText,
  toBoolean,
  toNumber,
  toText,
  type SheetArg,
  type SheetRangeArg,
  type SheetResult,
} from './values'

/** What every function call is given besides its arguments. */
export interface SheetFunctionContext {
  /** When the calculation started; `TODAY()` and `NOW()` read it. */
  now: Date
  /** The language dates are written in, for `TEXT`. */
  locale?: string
}

interface FunctionBase {
  /** The name formulas call it by; matched in any case. */
  name: string
  /** The fewest and most arguments it takes; `#VALUE!` otherwise. */
  minArgs?: number
  maxArgs?: number
  /** Gives a new result on every recalculation, like `TODAY()`. */
  volatile?: boolean
  /**
   * The arguments' names, shown while typing a call: `[name]` may be left
   * out and `…` repeats the one before, e.g. `['金额', '[税率]']`.
   */
  args?: string[]
  /** What it does, in a few words, shown in the list of functions. */
  description?: string
}

/**
 * A formula function. `run` gets each argument as a value, or as a range
 * for a reference to more than one cell (see `numbersOf`, `toNumber` and
 * the other helpers), and returns the result, or a range as `CHOOSE` can.
 * With `lazy`, it gets each argument as a function to call when needed, as
 * `IF` does to work out only the branch it takes.
 */
export type SheetFunction =
  | (FunctionBase & {
      lazy?: false
      run: (args: SheetArg[], context: SheetFunctionContext) => SheetArg
    })
  | (FunctionBase & {
      lazy: true
      run: (args: (() => SheetArg)[], context: SheetFunctionContext) => SheetArg
    })

/** Declares a formula function; only gives it a type. */
export function defineSheetFunction<T extends SheetFunction>(definition: T): T {
  return definition
}

// Helpers --------------------------------------------------------------------------------

/** A single value from an argument: a range of one cell is that cell, a bigger one `#VALUE!`. */
export function scalarOf(arg: SheetArg): SheetResult {
  if (!isRange(arg)) return arg
  return arg.rows === 1 && arg.cols === 1 ? arg.at(0, 0) : VALUE
}

/** A date or time written in a cell, as its day number; `null` for anything else. */
const serialIn = (value: SheetResult) =>
  typeof value === 'string' && (isDateText(value) || isTimeText(value)) ? serialOf(value) : null

/**
 * The numbers in some arguments, the way sums count them: in ranges only
 * numbers, dates and times count (other text, `TRUE` / `FALSE` and empty cells are skipped);
 * given directly, text that reads as a number and `TRUE` / `FALSE` count
 * too. The first error found is returned instead.
 */
export function numbersOf(args: SheetArg[]): number[] | SheetError {
  const out: number[] = []
  for (const arg of args) {
    if (isRange(arg)) {
      for (const [, , value] of arg.entries()) {
        if (isSheetError(value)) return value
        if (typeof value === 'number') out.push(value)
        else {
          const serial = serialIn(value)
          if (serial != null) out.push(serial)
        }
      }
    } else if (arg != null) {
      const n = toNumber(arg)
      if (isSheetError(n)) return n
      out.push(n)
    }
  }
  return out
}

/** Every value in some arguments, ranges cell by cell (their empty cells left out). */
function* valuesOf(args: SheetArg[]): Generator<SheetResult> {
  for (const arg of args) {
    if (isRange(arg)) for (const [, , value] of arg.entries()) yield value
    else yield arg
  }
}

/**
 * Whether all the numbers `numbersOf` takes from some arguments are dates,
 * or all times, so `SUM` of times is a time and `MAX` of dates a date.
 */
function kindOf(args: SheetArg[]): 'date' | 'time' | null {
  let kind: 'date' | 'time' | null = null
  for (const value of valuesOf(args)) {
    if (value == null || isSheetError(value)) continue
    const k = isDateText(value) ? 'date' : isTimeText(value) ? 'time' : null
    // other text is skipped in ranges; a number makes it numbers
    if (!k && typeof value === 'string') continue
    if (!k || (kind && kind !== k)) return null
    kind = k
  }
  return kind
}

const num = (arg: SheetArg) => toNumber(scalarOf(arg))
const text = (arg: SheetArg) => toText(scalarOf(arg))
const bool = (arg: SheetArg) => toBoolean(scalarOf(arg))
const finite = (n: number) => (Number.isFinite(n) ? n : NUM)

/** Rounds half away from zero, in decimal, so 1.005 rounds to 1.01. */
function roundTo(n: number, digits: number, mode: 'round' | 'up' | 'down' = 'round') {
  const d = Math.trunc(digits)
  const scaled = Math.abs(n) * 10 ** d
  const fixed = Number(scaled.toPrecision(15))
  const r =
    mode === 'round' ? Math.round(fixed) : mode === 'up' ? Math.ceil(fixed) : Math.floor(fixed)
  return Math.sign(n) * Number((r / 10 ** d).toPrecision(15))
}

const firstError = (...values: unknown[]) => values.find(isSheetError) as SheetError | undefined

/** Whether a lazy argument was given: not left out, nor left empty between commas. */
const given = (arg: (() => SheetArg) | undefined) => arg != null && arg() != null

/** A branch's value as `IF` and `CHOOSE` give it: a range stays one, for `SUM(IF(…, A1:A3, B1:B3))`. */
const passOn = (arg: SheetArg): SheetArg => (isRange(arg) ? arg : (arg ?? 0))

function math(
  name: string,
  run: (...n: number[]) => SheetResult,
  minArgs: number,
  maxArgs = minArgs,
) {
  return defineSheetFunction({
    name,
    minArgs,
    maxArgs,
    run: (args) => {
      const ns = args.map((arg) => (arg == null ? 0 : num(arg)))
      const error = firstError(...ns)
      if (error) return error
      const out = run(...(ns as number[]))
      return typeof out === 'number' ? finite(out) : out
    },
  })
}

function textFn(
  name: string,
  run: (...s: string[]) => SheetResult,
  minArgs = 1,
  maxArgs = minArgs,
) {
  return defineSheetFunction({
    name,
    minArgs,
    maxArgs,
    run: (args) => {
      const ss = args.map(text)
      const error = firstError(...ss)
      return error ?? run(...(ss as string[]))
    },
  })
}

/** Wildcards `*` and `?` (`~` before one keeps it) as a regular expression matching whole text. */
function wildcard(pattern: string) {
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!
    if (c === '~' && i + 1 < pattern.length)
      source += pattern[++i]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (c === '*') source += '.*'
    else if (c === '?') source += '.'
    else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`, 'is')
}

/**
 * A condition as `SUMIF` and `COUNTIF` take it: a value to equal, or text
 * such as `">5"`, `"<>完成"`, `"上海*"` (with `*` and `?`), `""` for empty.
 */
export function criteriaOf(criteria: SheetResult): (value: SheetResult) => boolean {
  if (typeof criteria !== 'string')
    return (value) => value != null && compareValues(value, criteria) === 0
  const op = /^(<>|<=|>=|=|<|>)?(.*)$/s.exec(criteria)!
  const how = op[1] ?? '='
  const rest = op[2]!
  const asNumber =
    rest.trim() === ''
      ? null
      : (serialOf(rest.trim()) ??
        (() => {
          const n = toNumber(rest)
          return typeof n === 'number' ? n : null
        })())
  if (asNumber != null) {
    const test = (n: number) =>
      how === '='
        ? n === asNumber
        : how === '<>'
          ? n !== asNumber
          : how === '<'
            ? n < asNumber
            : how === '>'
              ? n > asNumber
              : how === '<='
                ? n <= asNumber
                : n >= asNumber
    return (value) => {
      if (typeof value === 'number') return test(value)
      if (typeof value === 'string') {
        const serial = serialOf(value)
        if (serial != null) return test(serial)
      }
      return how === '<>'
    }
  }
  if (how === '=' || how === '<>') {
    const match =
      rest === ''
        ? (value: SheetResult) => value == null || value === ''
        : /[*?~]/.test(rest)
          ? (
              (re) => (value: SheetResult) =>
                typeof value === 'string' && re.test(value)
            )(wildcard(rest))
          : (value: SheetResult) =>
              typeof value === 'string' && value.toLowerCase() === rest.toLowerCase()
    return how === '=' ? match : (value) => !match(value)
  }
  return (value) => {
    if (typeof value !== 'string') return false
    const c = compareValues(value, rest)
    return how === '<' ? c < 0 : how === '>' ? c > 0 : how === '<=' ? c <= 0 : c >= 0
  }
}

/** The ranges and conditions of `SUMIFS`-like functions, as the positions that meet all of them. */
function matching(ranges: SheetRangeArg[], criteria: SheetResult[]) {
  const first = ranges[0]!
  for (const range of ranges)
    if (range.rows !== first.rows || range.cols !== first.cols) return VALUE
  const tests = criteria.map(criteriaOf)
  const out: [number, number][] = []
  // blank cells meet some conditions too (`""`, `"<>x"`), so every cell is checked
  for (let r = 0; r < first.rows; r++)
    for (let c = 0; c < first.cols; c++)
      if (tests.every((test, i) => test(ranges[i]!.at(r, c)))) out.push([r, c])
  return out
}

/** For `SUMIF` and the like on sparse data: only cells with data, unless the condition takes empty ones. */
function matchingOne(range: SheetRangeArg, criteria: SheetResult) {
  const test = criteriaOf(criteria)
  if (test(null)) return matching([range], [criteria])
  const out: [number, number][] = []
  for (const [r, c, value] of range.entries()) if (test(value)) out.push([r, c])
  return out
}

function lookupIndex(
  value: SheetResult,
  length: number,
  at: (i: number) => SheetResult,
  mode: 'exact' | 'below' | 'above' | 'wildcard',
  reverse = false,
) {
  if (mode === 'wildcard' && typeof value === 'string') {
    const re = wildcard(value)
    for (let k = 0; k < length; k++) {
      const i = reverse ? length - 1 - k : k
      const v = at(i)
      if (typeof v === 'string' && re.test(v)) return i
    }
    return -1
  }
  let best = -1
  let bestValue: SheetResult = null
  for (let k = 0; k < length; k++) {
    const i = reverse ? length - 1 - k : k
    const v = at(i)
    if (v == null || isSheetError(v)) continue
    const c = compareValues(v, value)
    if (c === 0 && (typeof v === typeof value || (v === '' && value == null))) return i
    if (
      mode === 'below' &&
      c < 0 &&
      typeof v === typeof value &&
      (best === -1 || compareValues(v, bestValue) > 0)
    ) {
      best = i
      bestValue = v
    }
    if (
      mode === 'above' &&
      c > 0 &&
      typeof v === typeof value &&
      (best === -1 || compareValues(v, bestValue) < 0)
    ) {
      best = i
      bestValue = v
    }
  }
  return best
}

/** The last position in sorted data whose value isn't above `value`, as approximate lookups find it. */
function sortedIndex(value: SheetResult, length: number, at: (i: number) => SheetResult) {
  let lo = 0
  let hi = length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = at(mid)
    if (v == null) {
      hi = mid - 1
      continue
    }
    if (compareValues(v, value) <= 0) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

/** `XMATCH` in sorted data, halving it each step: exact, or the nearest below or above. */
function halvingIndex(
  value: SheetResult,
  length: number,
  at: (i: number) => SheetResult,
  how: 'exact' | 'below' | 'above',
  descending: boolean,
) {
  const get = (i: number) => at(descending ? length - 1 - i : i)
  const comparable = (v: SheetResult) => v != null && !isSheetError(v) && typeof v === typeof value
  // the last value not above the one looked for
  let lo = 0
  let hi = length - 1
  let last = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const v = get(mid)
    if (comparable(v) && compareValues(v, value) <= 0) {
      last = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  let i = -1
  if (last !== -1 && compareValues(get(last), value) === 0) i = last
  else if (how === 'below') i = last
  else if (how === 'above' && last + 1 < length) i = last + 1
  return i === -1 ? -1 : descending ? length - 1 - i : i
}

const asRange = (arg: SheetArg): SheetRangeArg =>
  isRange(arg)
    ? arg
    : {
        kind: 'range',
        rows: 1,
        cols: 1,
        at: () => arg,
        entries: () => (arg == null ? [] : [[0, 0, arg]]),
      }

const pad = (n: number) => String(n).padStart(2, '0')
function localDay(now: Date) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// Helpers of the second batch ------------------------------------------------------------

/** Keeps a result to 15 significant digits, so `CEILING(2.3, 0.1)` is 2.3, not 2.3000000000000003. */
const tidy = (n: number) => (Number.isFinite(n) ? Number(n.toPrecision(15)) : NUM)

/** Numbers from ranges and values for the statistics, at least `least` of them, else `few`. */
function statsOf(args: SheetArg[], least: number, few: SheetError): number[] | SheetError {
  const ns = numbersOf(args)
  if (isSheetError(ns)) return ns
  return ns.length < least ? few : ns
}

const mean = (ns: number[]) => sum(ns) / ns.length

/** The variance of numbers: of a sample (divided by n - 1), or of all of them. */
function variance(ns: number[], sample: boolean) {
  const m = mean(ns)
  let squares = 0
  for (const n of ns) squares += (n - m) ** 2
  return squares / (ns.length - (sample ? 1 : 0))
}

/** Sorted from smallest, without changing the list given. */
const ascending = (ns: number[]) => {
  const out = ns.slice()
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts its own copy
  out.sort((a, b) => a - b)
  return out
}

/** The value `k` (0–1) of the way through sorted numbers, between the two nearest. */
function percentile(sorted: number[], k: number) {
  const at = (sorted.length - 1) * k
  const lo = Math.floor(at)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo)
}

/** A day number from a date argument; `null` when it isn't one. */
function serialArg(arg: SheetArg): number | SheetError | null {
  const v = scalarOf(arg)
  if (isSheetError(v)) return v
  if (typeof v === 'number') return v
  if (typeof v === 'string') return serialOf(v.trim())
  return v == null ? 0 : null
}

/** A day number as a date, without its time. */
const dayText = (serial: number) => dateText(Math.floor(serial))

/** The day number of a year, month and day, months past 12 or below 1 rolling over. */
const serialFor = (year: number, month: number, day: number) =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000

/** 0 for Sunday to 6 for Saturday. */
const weekdayOf = (serial: number) => (((Math.floor(serial) + 6) % 7) + 7) % 7

/** The holidays of `NETWORKDAYS` and `WORKDAY`, as day numbers. */
function holidaysOf(arg: SheetArg | undefined): Set<number> | SheetError {
  const out = new Set<number>()
  if (arg == null) return out
  for (const value of valuesOf([arg])) {
    if (isSheetError(value)) return value
    if (value == null || value === '') continue
    const serial = typeof value === 'number' ? value : serialOf(String(value).trim())
    if (serial == null) return VALUE
    out.add(Math.floor(serial))
  }
  return out
}

const isWeekday = (serial: number) => {
  const day = weekdayOf(serial)
  return day !== 0 && day !== 6
}

/** The last day number dates can have, 9999-12-31. */
const LAST_DAY = 2_958_465

/** Monday to Friday from `from` to `to`, both counted, by whole weeks: any seven days hold five. */
function weekdaysBetween(from: number, to: number) {
  const weeks = Math.floor((to - from + 1) / 7)
  let count = weeks * 5
  for (let day = from + weeks * 7; day <= to; day++) if (isWeekday(day)) count++
  return count
}

/** The day `n` weekdays after `day` (before it when negative), by whole weeks. */
function weekdaysOn(day: number, n: number) {
  const step = n < 0 ? -1 : 1
  let left = Math.abs(n)
  const weeks = left > 0 ? Math.floor((left - 1) / 5) : 0
  day += step * weeks * 7
  left -= weeks * 5
  while (left > 0) {
    day += step
    if (isWeekday(day)) left--
  }
  return day
}

/** Holidays on weekdays from `from` to `to`, both counted. */
function holidaysBetween(holidays: Set<number>, from: number, to: number) {
  let count = 0
  for (const day of holidays) if (day >= from && day <= to && isWeekday(day)) count++
  return count
}

/** The day `WEEKNUM`'s weeks start on for each type, 0 for Sunday. */
const WEEK_STARTS: Record<number, number> = {
  1: 0,
  2: 1,
  11: 1,
  12: 2,
  13: 3,
  14: 4,
  15: 5,
  16: 6,
  17: 0,
}

/** The ISO week number: weeks start on Monday, the first holds the year's first Thursday. */
function isoWeek(serial: number) {
  const day = Math.floor(serial)
  const thursday = day - ((weekdayOf(day) + 6) % 7) + 3
  const year = new Date(thursday * 86_400_000 + Date.UTC(1899, 11, 30)).getUTCFullYear()
  return Math.floor((thursday - serialFor(year, 1, 1)) / 7) + 1
}

/** Where a delimiter is in text, every time, for `TEXTBEFORE` and `TEXTAFTER`. */
function positionsOf(t: string, delimiter: string, ignoreCase: boolean) {
  const hay = ignoreCase ? t.toLowerCase() : t
  const needle = ignoreCase ? delimiter.toLowerCase() : delimiter
  const out: number[] = []
  // nothing is found before every character and at the end
  if (!needle) {
    for (let at = 0; at <= t.length; at++) out.push(at)
    return out
  }
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length))
    out.push(at)
  return out
}

/** The payment of a loan or saving each period, as `PMT` works it out. */
function payment(rate: number, nper: number, pv: number, fv: number, type: number) {
  if (rate === 0) return -(pv + fv) / nper
  const grow = (1 + rate) ** nper
  return (-(pv * grow + fv) * rate) / ((1 + rate * type) * (grow - 1))
}

// The functions ---------------------------------------------------------------------------

/** One of the numbers taken from some arguments, written as they are: a date or a time when they all are. */
function asInputs(args: SheetArg[], n: number): SheetResult {
  const kind = kindOf(args)
  return kind === 'date' ? dateText(n) : kind === 'time' ? timeText(n) : n
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)

export const builtinFunctions: SheetFunction[] = [
  // math
  defineSheetFunction({
    name: 'SUM',
    run: (args) => {
      const ns = numbersOf(args)
      if (isSheetError(ns)) return ns
      const total = finite(sum(ns))
      // times add up to a time, as `+` adds them
      return typeof total === 'number' && kindOf(args) === 'time' ? timeOrDays(total) : total
    },
  }),
  defineSheetFunction({
    name: 'PRODUCT',
    run: (args) => {
      const ns = numbersOf(args)
      return isSheetError(ns) ? ns : finite(ns.reduce((a, b) => a * b, 1))
    },
  }),
  defineSheetFunction({
    name: 'AVERAGE',
    minArgs: 1,
    run: (args) => {
      const ns = numbersOf(args)
      if (isSheetError(ns)) return ns
      return ns.length ? sum(ns) / ns.length : DIV0
    },
  }),
  defineSheetFunction({
    name: 'MIN',
    run: (args) => {
      const ns = numbersOf(args)
      return isSheetError(ns) ? ns : ns.length ? asInputs(args, Math.min(...ns)) : 0
    },
  }),
  defineSheetFunction({
    name: 'MAX',
    run: (args) => {
      const ns = numbersOf(args)
      return isSheetError(ns) ? ns : ns.length ? asInputs(args, Math.max(...ns)) : 0
    },
  }),
  defineSheetFunction({
    name: 'COUNT',
    run: (args) => {
      let n = 0
      for (const arg of args) {
        if (isRange(arg)) {
          for (const [, , v] of arg.entries()) if (typeof v === 'number' || serialIn(v) != null) n++
        } else if (arg != null && !isSheetError(toNumber(arg))) n++
      }
      return n
    },
  }),
  defineSheetFunction({
    name: 'COUNTA',
    run: (args) => {
      let n = 0
      for (const value of valuesOf(args)) if (value != null && value !== '') n++
      return n
    },
  }),
  defineSheetFunction({
    name: 'COUNTBLANK',
    minArgs: 1,
    maxArgs: 1,
    run: ([arg]) => {
      const range = asRange(arg!)
      let filled = 0
      for (const [, , v] of range.entries()) if (v != null && v !== '') filled++
      return range.rows * range.cols - filled
    },
  }),
  math('ABS', Math.abs, 1),
  math('INT', Math.floor, 1),
  math('SQRT', (n) => (n < 0 ? NUM : Math.sqrt(n)), 1),
  math('POWER', (a, b) => a ** b, 2),
  math('MOD', (a, b) => (b === 0 ? DIV0 : a - b * Math.floor(a / b)), 2),
  math('ROUND', (n, d = 0) => roundTo(n, d), 1, 2),
  math('ROUNDUP', (n, d = 0) => roundTo(n, d, 'up'), 1, 2),
  math('ROUNDDOWN', (n, d = 0) => roundTo(n, d, 'down'), 1, 2),

  // logic
  defineSheetFunction({
    name: 'IF',
    lazy: true,
    minArgs: 2,
    maxArgs: 3,
    run: ([test, then, otherwise]) => {
      const b = bool(test!())
      if (isSheetError(b)) return b
      if (b) return passOn(then!())
      return otherwise ? passOn(otherwise()) : false
    },
  }),
  defineSheetFunction({
    name: 'IFS',
    lazy: true,
    minArgs: 2,
    run: (args) => {
      if (args.length % 2) return VALUE
      for (let i = 0; i < args.length; i += 2) {
        const b = bool(args[i]!())
        if (isSheetError(b)) return b
        if (b) return passOn(args[i + 1]!())
      }
      return NA
    },
  }),
  defineSheetFunction({
    name: 'IFERROR',
    lazy: true,
    minArgs: 2,
    maxArgs: 2,
    run: ([value, fallback]) => {
      const v = scalarOf(value!())
      return isSheetError(v) ? (scalarOf(fallback!()) ?? 0) : (v ?? 0)
    },
  }),
  defineSheetFunction({
    name: 'IFNA',
    lazy: true,
    minArgs: 2,
    maxArgs: 2,
    run: ([value, fallback]) => {
      const v = scalarOf(value!())
      return v === NA ? (scalarOf(fallback!()) ?? 0) : (v ?? 0)
    },
  }),
  ...(['AND', 'OR'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 1,
      run: (args) => {
        let seen = false
        let out = name === 'AND'
        for (const arg of args) {
          const values = isRange(arg) ? arg.entries() : [[0, 0, arg] as const]
          for (const [, , value] of values) {
            // in ranges only numbers and TRUE / FALSE count
            if (value == null || (isRange(arg) && typeof value === 'string')) continue
            const b = toBoolean(value)
            if (isSheetError(b)) return b
            seen = true
            if (name === 'AND' && !b) out = false
            if (name === 'OR' && b) out = true
          }
        }
        return seen ? out : VALUE
      },
    }),
  ),
  defineSheetFunction({
    name: 'NOT',
    minArgs: 1,
    maxArgs: 1,
    run: ([a]) => {
      const b = bool(a!)
      return isSheetError(b) ? b : !b
    },
  }),
  ...(
    [
      ['ISBLANK', (v: SheetResult) => v == null],
      ['ISNUMBER', (v: SheetResult) => typeof v === 'number'],
      ['ISTEXT', (v: SheetResult) => typeof v === 'string'],
      ['ISERROR', (v: SheetResult) => isSheetError(v)],
      ['ISNA', (v: SheetResult) => v === NA],
    ] as const
  ).map(([name, test]) =>
    defineSheetFunction({ name, minArgs: 1, maxArgs: 1, run: ([a]) => test(scalarOf(a!)) }),
  ),

  // text
  defineSheetFunction({
    name: 'CONCAT',
    run: (args) => {
      let out = ''
      for (const value of valuesOf(args)) {
        const t = toText(value)
        if (isSheetError(t)) return t
        out += t
      }
      return out
    },
  }),
  defineSheetFunction({
    name: 'CONCATENATE',
    minArgs: 1,
    run: (args) => {
      let out = ''
      for (const arg of args) {
        const t = text(arg)
        if (isSheetError(t)) return t
        out += t
      }
      return out
    },
  }),
  defineSheetFunction({
    name: 'TEXTJOIN',
    minArgs: 3,
    run: ([delimiter, ignoreEmpty, ...rest]) => {
      const d = text(delimiter!)
      const skip = bool(ignoreEmpty!)
      const error = firstError(d, skip)
      if (error) return error
      const parts: string[] = []
      for (const value of valuesOf(rest)) {
        const t = toText(value)
        if (isSheetError(t)) return t
        if (t !== '' || !skip) parts.push(t)
      }
      return parts.join(d as string)
    },
  }),
  defineSheetFunction({
    name: 'LEFT',
    minArgs: 1,
    maxArgs: 2,
    run: ([s, n]) => {
      const t = text(s!)
      const count = n == null ? 1 : num(n)
      const error = firstError(t, count)
      if (error) return error
      return (count as number) < 0 ? VALUE : [...(t as string)].slice(0, count as number).join('')
    },
  }),
  defineSheetFunction({
    name: 'RIGHT',
    minArgs: 1,
    maxArgs: 2,
    run: ([s, n]) => {
      const t = text(s!)
      const count = n == null ? 1 : num(n)
      const error = firstError(t, count)
      if (error) return error
      const chars = [...(t as string)]
      return (count as number) < 0
        ? VALUE
        : chars.slice(Math.max(0, chars.length - (count as number))).join('')
    },
  }),
  defineSheetFunction({
    name: 'MID',
    minArgs: 3,
    maxArgs: 3,
    run: ([s, start, n]) => {
      const t = text(s!)
      const from = num(start!)
      const count = num(n!)
      const error = firstError(t, from, count)
      if (error) return error
      if ((from as number) < 1 || (count as number) < 0) return VALUE
      return [...(t as string)]
        .slice((from as number) - 1, (from as number) - 1 + (count as number))
        .join('')
    },
  }),
  textFn('LEN', (s) => [...s].length),
  textFn('TRIM', (s) => s.trim().replace(/ {2,}/g, ' ')),
  textFn('UPPER', (s) => s.toUpperCase()),
  textFn('LOWER', (s) => s.toLowerCase()),
  textFn('EXACT', (a, b) => a === b, 2),
  defineSheetFunction({
    name: 'REPT',
    minArgs: 2,
    maxArgs: 2,
    run: ([s, n]) => {
      const t = text(s!)
      const count = num(n!)
      const error = firstError(t, count)
      if (error) return error
      return (count as number) < 0 ? VALUE : (t as string).repeat(Math.floor(count as number))
    },
  }),
  defineSheetFunction({
    name: 'SUBSTITUTE',
    minArgs: 3,
    maxArgs: 4,
    run: ([s, from, to, which]) => {
      const t = text(s!)
      const a = text(from!)
      const b = text(to!)
      const nth = which == null ? null : num(which)
      const error = firstError(t, a, b, nth)
      if (error) return error
      if (a === '') return t
      if (nth == null) return (t as string).split(a as string).join(b as string)
      let at = -1
      for (let i = 0; i < (nth as number); i++) {
        at = (t as string).indexOf(a as string, at + 1)
        if (at === -1) return t
      }
      return (t as string).slice(0, at) + b + (t as string).slice(at + (a as string).length)
    },
  }),
  ...(['FIND', 'SEARCH'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 2,
      maxArgs: 3,
      run: ([what, within, start]) => {
        const a = text(what!)
        const t = text(within!)
        const from = start == null ? 1 : num(start)
        const error = firstError(a, t, from)
        if (error) return error
        const at =
          name === 'FIND'
            ? (t as string).indexOf(a as string, (from as number) - 1)
            : (t as string).toLowerCase().indexOf((a as string).toLowerCase(), (from as number) - 1)
        return at === -1 ? VALUE : at + 1
      },
    }),
  ),
  defineSheetFunction({
    name: 'TEXT',
    minArgs: 2,
    maxArgs: 2,
    run: ([value, format], context) => {
      const v = scalarOf(value!)
      const f = text(format!)
      const error = firstError(v, f)
      if (error) return error
      // a number in a date or time format is a day number, as `TEXT(B2 + 1/24, "hh:mm")` gives
      const shown = typeof v === 'number' && isDateFormat(f as string) ? dateText(v) : v
      return formatValue(shown as string | number | boolean | null, f as string, context.locale)
    },
  }),
  defineSheetFunction({
    name: 'VALUE',
    minArgs: 1,
    maxArgs: 1,
    run: ([value]) => {
      const v = scalarOf(value!)
      return typeof v === 'boolean' ? VALUE : toNumber(v)
    },
  }),

  // dates
  defineSheetFunction({
    name: 'TODAY',
    maxArgs: 0,
    volatile: true,
    run: (_, c) => localDay(c.now),
  }),
  defineSheetFunction({
    name: 'NOW',
    maxArgs: 0,
    volatile: true,
    run: (_, c) => `${localDay(c.now)} ${pad(c.now.getHours())}:${pad(c.now.getMinutes())}`,
  }),
  math(
    'DATE',
    (y, m, d) => {
      const year = Math.floor(y) < 1900 ? Math.floor(y) + 1900 : Math.floor(y)
      const ms = Date.UTC(year, Math.floor(m) - 1, Math.floor(d))
      return Number.isNaN(ms) ? NUM : dateText((ms - Date.UTC(1899, 11, 30)) / 86_400_000)
    },
    3,
  ),
  ...(['YEAR', 'MONTH', 'DAY'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 1,
      maxArgs: 1,
      run: ([value]) => {
        const v = scalarOf(value!)
        if (isSheetError(v)) return v
        const parts = dateParts(v)
        if (!parts) return VALUE
        return name === 'YEAR' ? parts.year : name === 'MONTH' ? parts.month : parts.day
      },
    }),
  ),
  defineSheetFunction({
    name: 'WEEKDAY',
    minArgs: 1,
    maxArgs: 2,
    run: ([value, type]) => {
      const parts = dateParts(scalarOf(value!))
      const t = type == null ? 1 : num(type)
      if (isSheetError(t)) return t
      if (!parts) return VALUE
      // 1899-12-30 was a Saturday
      const sunday0 = (((Math.floor(parts.serial) + 6) % 7) + 7) % 7
      if (t === 1) return sunday0 + 1
      if (t === 2) return ((sunday0 + 6) % 7) + 1
      if (t === 3) return (sunday0 + 6) % 7
      return NUM
    },
  }),
  defineSheetFunction({
    name: 'DATEDIF',
    minArgs: 3,
    maxArgs: 3,
    run: ([start, end, unit]) => {
      const a = dateParts(scalarOf(start!))
      const b = dateParts(scalarOf(end!))
      const u = text(unit!)
      if (isSheetError(u)) return u
      if (!a || !b) return VALUE
      if (a.serial > b.serial) return NUM
      const months = (b.year - a.year) * 12 + (b.month - a.month) - (b.day < a.day ? 1 : 0)
      switch ((u as string).toUpperCase()) {
        case 'Y':
          return Math.floor(months / 12)
        case 'M':
          return months
        case 'D':
          return Math.floor(b.serial) - Math.floor(a.serial)
        case 'MD':
          return b.day >= a.day ? b.day - a.day : daysInMonth(b.year, b.month - 1) - a.day + b.day
        case 'YM':
          return months % 12
        case 'YD': {
          const year =
            b.month > a.month || (b.month === a.month && b.day >= a.day) ? b.year : b.year - 1
          const from = Date.UTC(year, a.month - 1, a.day)
          const to = Date.UTC(b.year, b.month - 1, b.day)
          return Math.round((to - from) / 86_400_000)
        }
        default:
          return NUM
      }
    },
  }),

  // conditions
  ...(['SUMIF', 'AVERAGEIF'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 2,
      maxArgs: 3,
      run: ([range, criteria, sumRange]) => {
        const where = asRange(range!)
        const c = scalarOf(criteria!)
        if (isSheetError(c)) return c
        const values = sumRange == null ? where : asRange(sumRange)
        let total = 0
        let count = 0
        for (const [r, col] of matchingOne(where, c) as [number, number][]) {
          const v = r < values.rows && col < values.cols ? values.at(r, col) : null
          if (isSheetError(v)) return v
          if (typeof v === 'number') {
            total += v
            count++
          }
        }
        if (name === 'SUMIF') return total
        return count ? total / count : DIV0
      },
    }),
  ),
  defineSheetFunction({
    name: 'COUNTIF',
    minArgs: 2,
    maxArgs: 2,
    run: ([range, criteria]) => {
      const c = scalarOf(criteria!)
      if (isSheetError(c)) return c
      return (matchingOne(asRange(range!), c) as [number, number][]).length
    },
  }),
  ...(['SUMIFS', 'AVERAGEIFS'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 3,
      run: ([target, ...pairs]) => {
        if (pairs.length % 2) return VALUE
        const ranges = [asRange(target!)]
        const criteria: SheetResult[] = [null]
        for (let i = 0; i < pairs.length; i += 2) {
          ranges.push(asRange(pairs[i]!))
          const c = scalarOf(pairs[i + 1]!)
          if (isSheetError(c)) return c
          criteria.push(c)
        }
        const found = matching(ranges.slice(1), criteria.slice(1))
        if (isSheetError(found)) return found
        if (ranges[0]!.rows !== ranges[1]!.rows || ranges[0]!.cols !== ranges[1]!.cols) return VALUE
        let total = 0
        let count = 0
        for (const [r, c] of found) {
          const v = ranges[0]!.at(r, c)
          if (isSheetError(v)) return v
          if (typeof v === 'number') {
            total += v
            count++
          }
        }
        if (name === 'SUMIFS') return total
        return count ? total / count : DIV0
      },
    }),
  ),
  defineSheetFunction({
    name: 'COUNTIFS',
    minArgs: 2,
    run: (args) => {
      if (args.length % 2) return VALUE
      const ranges: SheetRangeArg[] = []
      const criteria: SheetResult[] = []
      for (let i = 0; i < args.length; i += 2) {
        ranges.push(asRange(args[i]!))
        const c = scalarOf(args[i + 1]!)
        if (isSheetError(c)) return c
        criteria.push(c)
      }
      const found = matching(ranges, criteria)
      return isSheetError(found) ? found : found.length
    },
  }),

  // lookups
  ...(['VLOOKUP', 'HLOOKUP'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 3,
      maxArgs: 4,
      run: ([value, table, index, approximate]) => {
        const v = scalarOf(value!)
        if (isSheetError(v)) return v
        const t = asRange(table!)
        const i = num(index!)
        const approx = approximate == null ? true : bool(approximate)
        const error = firstError(i, approx)
        if (error) return error
        const n = Math.floor(i as number)
        const vertical = name === 'VLOOKUP'
        const length = vertical ? t.rows : t.cols
        if (n < 1 || n > (vertical ? t.cols : t.rows)) return n < 1 ? VALUE : SheetError.of('#REF!')
        const key = (k: number) => (vertical ? t.at(k, 0) : t.at(0, k))
        const found = approx
          ? sortedIndex(v, length, key)
          : lookupIndex(v, length, key, /[*?]/.test(String(v)) ? 'wildcard' : 'exact')
        if (found === -1) return NA
        return vertical ? t.at(found, n - 1) : t.at(n - 1, found)
      },
    }),
  ),
  defineSheetFunction({
    name: 'MATCH',
    minArgs: 2,
    maxArgs: 3,
    run: ([value, range, type]) => {
      const v = scalarOf(value!)
      if (isSheetError(v)) return v
      const r = asRange(range!)
      if (r.rows > 1 && r.cols > 1) return NA
      const t = type == null ? 1 : num(type)
      if (isSheetError(t)) return t
      const length = Math.max(r.rows, r.cols)
      const at = (i: number) => (r.rows > 1 ? r.at(i, 0) : r.at(0, i))
      let found: number
      if (t === 0)
        found = lookupIndex(
          v,
          length,
          at,
          typeof v === 'string' && /[*?]/.test(v) ? 'wildcard' : 'exact',
        )
      else if ((t as number) > 0) found = sortedIndex(v, length, at)
      else {
        // sorted from largest: the last value not below it
        found = -1
        for (let i = 0; i < length; i++) {
          const x = at(i)
          if (x == null) break
          if (compareValues(x, v) >= 0) found = i
          else break
        }
      }
      return found === -1 ? NA : found + 1
    },
  }),
  defineSheetFunction({
    name: 'INDEX',
    minArgs: 2,
    maxArgs: 3,
    run: ([range, row, col]) => {
      const r = asRange(range!)
      const ri = num(row!)
      const ci = col == null ? 1 : num(col)
      const error = firstError(ri, ci)
      if (error) return error
      let y = Math.floor(ri as number)
      let x = Math.floor(ci as number)
      // one row given one number: it counts along the row
      if (col == null && r.rows === 1) [y, x] = [1, y]
      if (y < 1 || x < 1) return VALUE
      if (y > r.rows || x > r.cols) return SheetError.of('#REF!')
      return r.at(y - 1, x - 1)
    },
  }),
  defineSheetFunction({
    name: 'XLOOKUP',
    lazy: true,
    minArgs: 3,
    maxArgs: 6,
    run: ([value, lookup, results, notFound, matchMode, searchMode]) => {
      const v = scalarOf(value!())
      if (isSheetError(v)) return v
      const l = asRange(lookup!())
      const out = asRange(results!())
      if (l.rows > 1 && l.cols > 1) return VALUE
      const mode = matchMode ? num(matchMode()) : 0
      const search = searchMode ? num(searchMode()) : 1
      const error = firstError(mode, search)
      if (error) return error
      const vertical = l.rows > 1 || l.cols === 1
      const length = vertical ? l.rows : l.cols
      if ((vertical ? out.rows : out.cols) !== length) return VALUE
      const at = (i: number) => (vertical ? l.at(i, 0) : l.at(0, i))
      const how =
        mode === 0
          ? 'exact'
          : mode === -1
            ? 'below'
            : mode === 1
              ? 'above'
              : mode === 2
                ? 'wildcard'
                : null
      if (!how) return VALUE
      const found = lookupIndex(v, length, at, how, (search as number) < 0)
      if (found === -1) return notFound ? (scalarOf(notFound()) ?? 0) : NA
      return vertical ? out.at(found, 0) : out.at(0, found)
    },
  }),
  // math and statistics, the second batch
  defineSheetFunction({
    name: 'SUMPRODUCT',
    minArgs: 1,
    run: (args) => {
      const ranges = args.map(asRange)
      const first = ranges[0]!
      if (ranges.some((r) => r.rows !== first.rows || r.cols !== first.cols)) return VALUE
      let total = 0
      for (let r = 0; r < first.rows; r++)
        for (let c = 0; c < first.cols; c++) {
          let product = 1
          for (const range of ranges) {
            const v = range.at(r, c)
            if (isSheetError(v)) return v
            // only numbers count; anything else is 0
            product *= typeof v === 'number' ? v : 0
          }
          total += product
        }
      return finite(total)
    },
  }),
  defineSheetFunction({
    name: 'MEDIAN',
    minArgs: 1,
    run: (args) => {
      const ns = statsOf(args, 1, NUM)
      return isSheetError(ns) ? ns : percentile(ascending(ns), 0.5)
    },
  }),
  ...(['LARGE', 'SMALL'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 2,
      maxArgs: 2,
      run: ([values, nth]) => {
        const ns = numbersOf([values!])
        const k = num(nth!)
        const error = firstError(ns, k)
        if (error) return error
        const list = ascending(ns as number[])
        const i = Math.ceil(k as number)
        if (i < 1 || i > list.length) return NUM
        return name === 'SMALL' ? list[i - 1]! : list[list.length - i]!
      },
    }),
  ),
  ...(['RANK', 'RANK.EQ'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 2,
      maxArgs: 3,
      run: ([value, values, order]) => {
        const v = num(value!)
        const ns = numbersOf([asRange(values!)])
        const ascendingOrder = order == null ? false : bool(order)
        const error = firstError(v, ns, ascendingOrder)
        if (error) return error
        if (!(ns as number[]).includes(v as number)) return NA
        let rank = 1
        for (const n of ns as number[])
          if (ascendingOrder ? n < (v as number) : n > (v as number)) rank++
        return rank
      },
    }),
  ),
  ...(
    [
      ['STDEV', true, true],
      ['STDEV.S', true, true],
      ['STDEV.P', true, false],
      ['VAR', false, true],
      ['VAR.S', false, true],
      ['VAR.P', false, false],
    ] as const
  ).map(([name, root, sample]) =>
    defineSheetFunction({
      name,
      minArgs: 1,
      run: (args) => {
        const ns = statsOf(args, sample ? 2 : 1, DIV0)
        if (isSheetError(ns)) return ns
        const v = variance(ns, sample)
        return root ? Math.sqrt(v) : v
      },
    }),
  ),
  ...(['PERCENTILE', 'PERCENTILE.INC'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 2,
      maxArgs: 2,
      run: ([values, k]) => {
        const ns = numbersOf([values!])
        const at = num(k!)
        const error = firstError(ns, at)
        if (error) return error
        if (!(ns as number[]).length || (at as number) < 0 || (at as number) > 1) return NUM
        return tidy(percentile(ascending(ns as number[]), at as number))
      },
    }),
  ),
  ...(['MAXIFS', 'MINIFS'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 3,
      run: ([target, ...pairs]) => {
        if (pairs.length % 2) return VALUE
        const values = asRange(target!)
        const ranges: SheetRangeArg[] = []
        const criteria: SheetResult[] = []
        for (let i = 0; i < pairs.length; i += 2) {
          ranges.push(asRange(pairs[i]!))
          const c = scalarOf(pairs[i + 1]!)
          if (isSheetError(c)) return c
          criteria.push(c)
        }
        const found = matching(ranges, criteria)
        if (isSheetError(found)) return found
        if (values.rows !== ranges[0]!.rows || values.cols !== ranges[0]!.cols) return VALUE
        let best: number | null = null
        for (const [r, c] of found) {
          const v = values.at(r, c)
          if (isSheetError(v)) return v
          if (typeof v !== 'number') continue
          if (best == null || (name === 'MAXIFS' ? v > best : v < best)) best = v
        }
        return best ?? 0
      },
    }),
  ),
  math(
    'CEILING',
    (n, step = 1) => {
      if (step === 0) return 0
      if (n > 0 && step < 0) return NUM
      return tidy(Math.ceil(Number((n / step).toPrecision(15))) * step)
    },
    1,
    2,
  ),
  math(
    'FLOOR',
    (n, step = 1) => {
      if (step === 0) return n === 0 ? 0 : DIV0
      if (n > 0 && step < 0) return NUM
      return tidy(Math.floor(Number((n / step).toPrecision(15))) * step)
    },
    1,
    2,
  ),
  math(
    'MROUND',
    (n, step) => {
      if (step === 0 || n === 0) return 0
      if (Math.sign(n) !== Math.sign(step)) return NUM
      return tidy(roundTo(n / step, 0) * step)
    },
    2,
  ),
  math('TRUNC', (n, d = 0) => roundTo(n, d, 'down'), 1, 2),
  math('SIGN', Math.sign, 1),
  math('PI', () => Math.PI, 0),
  math('EXP', Math.exp, 1),
  math('LN', (n) => (n <= 0 ? NUM : Math.log(n)), 1),
  math('LOG10', (n) => (n <= 0 ? NUM : Math.log10(n)), 1),
  math(
    'LOG',
    (n, base = 10) => {
      if (n <= 0 || base <= 0) return NUM
      return base === 1 ? DIV0 : tidy(Math.log(n) / Math.log(base))
    },
    1,
    2,
  ),
  defineSheetFunction({
    name: 'RAND',
    maxArgs: 0,
    volatile: true,
    run: () => Math.random(),
  }),
  defineSheetFunction({
    name: 'RANDBETWEEN',
    minArgs: 2,
    maxArgs: 2,
    volatile: true,
    run: ([low, high]) => {
      const a = num(low!)
      const b = num(high!)
      const error = firstError(a, b)
      if (error) return error
      const lo = Math.ceil(a as number)
      const hi = Math.floor(b as number)
      if (lo > hi) return NUM
      return lo + Math.floor(Math.random() * (hi - lo + 1))
    },
  }),

  // logic, the second batch
  defineSheetFunction({
    name: 'XOR',
    minArgs: 1,
    run: (args) => {
      let seen = false
      let out = false
      for (const arg of args) {
        const values = isRange(arg) ? arg.entries() : [[0, 0, arg] as const]
        for (const [, , value] of values) {
          if (value == null || (isRange(arg) && typeof value === 'string')) continue
          const b = toBoolean(value)
          if (isSheetError(b)) return b
          seen = true
          if (b) out = !out
        }
      }
      return seen ? out : VALUE
    },
  }),
  defineSheetFunction({
    name: 'SWITCH',
    lazy: true,
    minArgs: 3,
    run: ([value, ...cases]) => {
      const v = scalarOf(value!())
      if (isSheetError(v)) return v
      for (let i = 0; i + 1 < cases.length; i += 2) {
        const c = scalarOf(cases[i]!())
        if (isSheetError(c)) return c
        // the same as `=` finds them: an empty cell is 0 and empty text
        if (compareValues(c, v) === 0) return passOn(cases[i + 1]!())
      }
      // an odd one at the end is the default
      return cases.length % 2 ? passOn(cases[cases.length - 1]!()) : NA
    },
  }),
  defineSheetFunction({
    name: 'CHOOSE',
    lazy: true,
    minArgs: 2,
    run: ([index, ...values]) => {
      const i = num(index!())
      if (isSheetError(i)) return i
      const at = Math.floor(i)
      if (at < 1 || at > values.length) return VALUE
      return passOn(values[at - 1]!())
    },
  }),
  defineSheetFunction({ name: 'NA', maxArgs: 0, run: () => NA }),
  ...(
    [
      ['ISLOGICAL', (v: SheetResult) => typeof v === 'boolean'],
      ['ISERR', (v: SheetResult) => isSheetError(v) && v !== NA],
    ] as const
  ).map(([name, test]) =>
    defineSheetFunction({ name, minArgs: 1, maxArgs: 1, run: ([a]) => test(scalarOf(a!)) }),
  ),
  ...(['ISEVEN', 'ISODD'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 1,
      maxArgs: 1,
      run: ([a]) => {
        const v = scalarOf(a!)
        if (typeof v === 'boolean') return VALUE
        const n = toNumber(v)
        if (isSheetError(n)) return n
        const even = Math.abs(Math.trunc(n)) % 2 === 0
        return name === 'ISEVEN' ? even : !even
      },
    }),
  ),

  // text, the second batch
  textFn('PROPER', (s) =>
    s
      .toLowerCase()
      .replace(
        /(^|[^\p{L}])(\p{L})/gu,
        (_, before: string, letter: string) => before + letter.toUpperCase(),
      ),
  ),
  // oxlint-disable-next-line no-control-regex -- CLEAN takes out exactly these
  textFn('CLEAN', (s) => s.replace(/[\u0000-\u001f]/g, '')),
  defineSheetFunction({
    name: 'REPLACE',
    minArgs: 4,
    maxArgs: 4,
    run: ([old, start, count, replacement]) => {
      const t = text(old!)
      const from = num(start!)
      const n = num(count!)
      const r = text(replacement!)
      const error = firstError(t, from, n, r)
      if (error) return error
      if ((from as number) < 1 || (n as number) < 0) return VALUE
      const chars = [...(t as string)]
      const at = Math.floor(from as number) - 1
      return [...chars.slice(0, at), r, ...chars.slice(at + Math.floor(n as number))].join('')
    },
  }),
  ...(['TEXTBEFORE', 'TEXTAFTER'] as const).map((name) =>
    defineSheetFunction({
      name,
      lazy: true,
      minArgs: 2,
      maxArgs: 6,
      run: ([value, delimiter, instance, matchMode, matchEnd, ifNotFound]) => {
        const t = text(value!())
        const d = text(delimiter!())
        // an argument left out, also between commas, takes its default
        const nth = given(instance) ? num(instance!()) : 1
        const mode = given(matchMode) ? num(matchMode!()) : 0
        const end = given(matchEnd) ? bool(matchEnd!()) : false
        const error = firstError(t, d, nth, mode, end)
        if (error) return error
        const source = t as string
        const k = Math.trunc(nth as number)
        if (k === 0 || Math.abs(k) > source.length + 1) return VALUE
        const found = positionsOf(source, d as string, mode === 1)
        // with `matchEnd` the end of the text counts as one more delimiter
        const starts = end ? [...found, source.length] : found
        const ends = end ? [0, ...found] : found
        const width = (d as string).length
        let at: number
        let after: number
        if (k > 0) {
          if (k > starts.length) return given(ifNotFound) ? (scalarOf(ifNotFound!()) ?? 0) : NA
          at = starts[k - 1]!
          after = at === source.length ? at : at + width
        } else {
          if (-k > ends.length) return given(ifNotFound) ? (scalarOf(ifNotFound!()) ?? 0) : NA
          at = ends[ends.length + k]!
          after = end && at === 0 && ends.length + k === 0 ? 0 : at + width
        }
        return name === 'TEXTBEFORE' ? source.slice(0, at) : source.slice(after)
      },
    }),
  ),
  ...(
    [
      ['CHAR', 255],
      ['UNICHAR', 0x10ffff],
    ] as const
  ).map(([name, most]) =>
    math(
      name,
      (n) => {
        const code = Math.trunc(n)
        return code < 1 || code > most ? VALUE : String.fromCodePoint(code)
      },
      1,
    ),
  ),
  ...(['CODE', 'UNICODE'] as const).map((name) =>
    textFn(name, (s) => (s === '' ? VALUE : s.codePointAt(0)!)),
  ),

  // dates and times, the second batch
  math(
    'TIME',
    (h, m, s) => {
      const seconds = Math.trunc(h) * 3600 + Math.trunc(m) * 60 + Math.trunc(s)
      return seconds < 0 ? NUM : timeText(seconds / 86_400)
    },
    3,
  ),
  ...(['HOUR', 'MINUTE', 'SECOND'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 1,
      maxArgs: 1,
      run: ([value]) => {
        const serial = serialArg(value!)
        if (isSheetError(serial)) return serial
        if (serial == null || serial < 0) return VALUE
        const seconds = Math.round((serial % 1) * 86_400) % 86_400
        if (name === 'HOUR') return Math.floor(seconds / 3600)
        if (name === 'MINUTE') return Math.floor((seconds % 3600) / 60)
        return seconds % 60
      },
    }),
  ),
  ...(['EDATE', 'EOMONTH'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 2,
      maxArgs: 2,
      run: ([start, months]) => {
        const parts = dateParts(scalarOf(start!))
        const n = num(months!)
        if (isSheetError(n)) return n
        if (!parts) return VALUE
        const month = parts.month + Math.trunc(n)
        if (name === 'EOMONTH') return dayText(serialFor(parts.year, month + 1, 0))
        // the same day, or the month's last when it is shorter
        const last = new Date(Date.UTC(parts.year, month, 0)).getUTCDate()
        return dayText(serialFor(parts.year, month, Math.min(parts.day, last)))
      },
    }),
  ),
  defineSheetFunction({
    name: 'DAYS',
    minArgs: 2,
    maxArgs: 2,
    run: ([end, start]) => {
      const b = serialArg(end!)
      const a = serialArg(start!)
      const error = firstError(a, b)
      if (error) return error
      if (a == null || b == null) return VALUE
      return Math.floor(b as number) - Math.floor(a as number)
    },
  }),
  defineSheetFunction({
    name: 'NETWORKDAYS',
    minArgs: 2,
    maxArgs: 3,
    run: ([start, end, holidays]) => {
      const a = serialArg(start!)
      const b = serialArg(end!)
      const off = holidaysOf(holidays)
      const error = firstError(a, b, off)
      if (error) return error
      if (a == null || b == null) return VALUE
      const from = Math.floor(Math.min(a as number, b as number))
      const to = Math.floor(Math.max(a as number, b as number))
      const count = weekdaysBetween(from, to) - holidaysBetween(off as Set<number>, from, to)
      return (a as number) > (b as number) ? -count : count
    },
  }),
  defineSheetFunction({
    name: 'WORKDAY',
    minArgs: 2,
    maxArgs: 3,
    run: ([start, days, holidays]) => {
      const a = serialArg(start!)
      const n = num(days!)
      const off = holidaysOf(holidays)
      const error = firstError(a, n, off)
      if (error) return error
      if (a == null) return VALUE
      const count = Math.trunc(n as number)
      if (!Number.isFinite(count) || Math.abs(count) > LAST_DAY) return NUM
      const step = count < 0 ? -1 : 1
      let from = Math.floor(a as number)
      let day = weekdaysOn(from, count)
      // each holiday passed on the way puts the day one weekday further
      for (;;) {
        const lo = Math.min(from, day)
        const hi = Math.max(from, day)
        const passed = holidaysBetween(
          off as Set<number>,
          lo + (step > 0 ? 1 : 0),
          hi - (step < 0 ? 1 : 0),
        )
        if (!passed) break
        from = day
        day = weekdaysOn(day, passed * step)
      }
      return day < 0 || day > LAST_DAY ? NUM : dayText(day)
    },
  }),
  defineSheetFunction({
    name: 'WEEKNUM',
    minArgs: 1,
    maxArgs: 2,
    run: ([value, type]) => {
      const serial = serialArg(value!)
      const t = type == null ? 1 : num(type)
      const error = firstError(serial, t)
      if (error) return error
      if (serial == null) return VALUE
      if (t === 21) return isoWeek(serial as number)
      // the day the week starts on, 0 for Sunday; the first week holds January 1
      const start = WEEK_STARTS[t as number]
      if (start == null) return NUM
      const day = Math.floor(serial as number)
      const year = new Date(day * 86_400_000 + Date.UTC(1899, 11, 30)).getUTCFullYear()
      const first = serialFor(year, 1, 1)
      const shift = (weekdayOf(first) - start + 7) % 7
      return Math.floor((day - first + shift) / 7) + 1
    },
  }),
  defineSheetFunction({
    name: 'ISOWEEKNUM',
    minArgs: 1,
    maxArgs: 1,
    run: ([value]) => {
      const serial = serialArg(value!)
      if (isSheetError(serial)) return serial
      return serial == null ? VALUE : isoWeek(serial)
    },
  }),
  ...(['DATEVALUE', 'TIMEVALUE'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 1,
      maxArgs: 1,
      run: ([value]) => {
        const t = text(value!)
        if (isSheetError(t)) return t
        // read as a cell reads what is typed into it: 2026/3/5, 2026-03-05 09:30, 9:30
        const typed = parseInput(t.trim()).value
        const serial = typeof typed === 'string' ? serialOf(typed) : null
        if (serial == null) return VALUE
        return name === 'DATEVALUE' ? dayText(serial) : timeText(serial % 1)
      },
    }),
  ),

  // lookups, the second batch
  defineSheetFunction({
    name: 'XMATCH',
    minArgs: 2,
    maxArgs: 4,
    run: ([value, values, matchMode, searchMode]) => {
      const v = scalarOf(value!)
      if (isSheetError(v)) return v
      const r = asRange(values!)
      if (r.rows > 1 && r.cols > 1) return VALUE
      const mode = matchMode == null ? 0 : num(matchMode)
      const search = searchMode == null ? 1 : num(searchMode)
      const error = firstError(mode, search)
      if (error) return error
      const how =
        mode === 0
          ? 'exact'
          : mode === -1
            ? 'below'
            : mode === 1
              ? 'above'
              : mode === 2
                ? 'wildcard'
                : null
      if (!how || ![1, -1, 2, -2].includes(search as number)) return VALUE
      const length = Math.max(r.rows, r.cols)
      const at = (i: number) => (r.rows > 1 ? r.at(i, 0) : r.at(0, i))
      // 2 and -2 search data sorted from smallest or from largest, by halves
      if (Math.abs(search as number) === 2 && how === 'wildcard') return VALUE
      const found =
        Math.abs(search as number) === 2
          ? halvingIndex(v, length, at, how as 'exact' | 'below' | 'above', search === -2)
          : lookupIndex(v, length, at, how, search === -1)
      return found === -1 ? NA : found + 1
    },
  }),
  ...(['ROWS', 'COLUMNS'] as const).map((name) =>
    defineSheetFunction({
      name,
      minArgs: 1,
      maxArgs: 1,
      run: ([range]) => {
        if (isSheetError(range)) return range
        const r = asRange(range!)
        return name === 'ROWS' ? r.rows : r.cols
      },
    }),
  ),

  // money
  math(
    'PMT',
    (rate, nper, pv, fv = 0, type = 0) =>
      nper === 0 ? NUM : payment(rate, nper, pv, fv, type ? 1 : 0),
    3,
    5,
  ),
  math(
    'FV',
    (rate, nper, pmt, pv = 0, type = 0) => {
      if (rate === 0) return -(pv + pmt * nper)
      const grow = (1 + rate) ** nper
      return -(pv * grow + (pmt * (1 + rate * (type ? 1 : 0)) * (grow - 1)) / rate)
    },
    3,
    5,
  ),
  math(
    'PV',
    (rate, nper, pmt, fv = 0, type = 0) => {
      if (rate === 0) return -(fv + pmt * nper)
      const grow = (1 + rate) ** nper
      return -(fv + (pmt * (1 + rate * (type ? 1 : 0)) * (grow - 1)) / rate) / grow
    },
    3,
    5,
  ),
  defineSheetFunction({
    name: 'NPV',
    minArgs: 2,
    run: ([rate, ...values]) => {
      const r = num(rate!)
      const ns = numbersOf(values)
      const error = firstError(r, ns)
      if (error) return error
      if (r === -1) return DIV0
      let total = 0
      ;(ns as number[]).forEach((n, i) => {
        total += n / (1 + (r as number)) ** (i + 1)
      })
      return finite(total)
    },
  }),
]
