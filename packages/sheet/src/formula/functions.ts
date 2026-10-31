import { formatValue } from '../core/format'
import { DIV0, isSheetError, NA, NUM, SheetError, VALUE } from './error'
import {
  compareValues,
  dateParts,
  dateText,
  isRange,
  serialOf,
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
}

/**
 * A formula function. `run` gets each argument as a value, or as a range
 * for a reference to more than one cell (see `numbersOf`, `toNumber` and
 * the other helpers), and returns the result. With `lazy`, it gets each
 * argument as a function to call when needed, as `IF` does to work out
 * only the branch it takes.
 */
export type SheetFunction =
  | (FunctionBase & {
      lazy?: false
      run: (args: SheetArg[], context: SheetFunctionContext) => SheetResult
    })
  | (FunctionBase & {
      lazy: true
      run: (args: (() => SheetArg)[], context: SheetFunctionContext) => SheetResult
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

/**
 * The numbers in some arguments, the way sums count them: in ranges only
 * numbers count (text, `TRUE` / `FALSE` and empty cells are skipped);
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

// The functions ---------------------------------------------------------------------------

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)

export const builtinFunctions: SheetFunction[] = [
  // math
  defineSheetFunction({
    name: 'SUM',
    run: (args) => {
      const ns = numbersOf(args)
      return isSheetError(ns) ? ns : finite(sum(ns))
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
      return isSheetError(ns) ? ns : ns.length ? Math.min(...ns) : 0
    },
  }),
  defineSheetFunction({
    name: 'MAX',
    run: (args) => {
      const ns = numbersOf(args)
      return isSheetError(ns) ? ns : ns.length ? Math.max(...ns) : 0
    },
  }),
  defineSheetFunction({
    name: 'COUNT',
    run: (args) => {
      let n = 0
      for (const arg of args) {
        if (isRange(arg)) {
          for (const [, , v] of arg.entries()) if (typeof v === 'number') n++
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
      if (b) return scalarOf(then!()) ?? 0
      return otherwise ? (scalarOf(otherwise()) ?? 0) : false
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
        if (b) return scalarOf(args[i + 1]!()) ?? 0
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
      return formatValue(v as string | number | boolean | null, f as string, context.locale)
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
]
