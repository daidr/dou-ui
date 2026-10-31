import type { Tone } from 'dou-ui'
import { boundsOf, parseRange, shiftFormula, type SheetBounds } from './address'
import { isEmptyValue, meetsCondition, textCollator } from './data'
import type {
  SheetColor,
  SheetConditionalFormat,
  SheetConditionalStyle,
  SheetRuleRange,
  SheetStyle,
} from './model'

/*
 * Conditional formats: which look each cell takes on from the rules of its
 * sheet. Rules that look at the whole range (ranks, averages, duplicates,
 * scales, bars) read it once, the first time a cell of it is asked about.
 */

/** What the rules give a cell: a style, and a bar to draw from `from` to `to` (0–1 of its width). */
export interface SheetLook {
  style?: SheetStyle
  bar?: { from: number; to: number; color: string }
  /** The same for looks that are the same, to tell when a cell's look changed. */
  key: string
}

/** What working out the looks needs from the grid. */
export interface SheetLookSource {
  /** What a cell comes to: its formula's result, or its value. */
  valueAt: (row: number, col: number) => unknown
  /** A cell's text as it shows. */
  textAt: (row: number, col: number) => string
  /** Works out a formula as if it were in a cell of the sheet. */
  evaluate: (formula: string) => unknown
  /**
   * What a cell holds now, compared with `===`: the cell as written, or
   * its formula's result. While every cell of a range holds the same, what
   * a rule read of the range is kept from the looks before.
   */
  cellStamp?: (row: number, col: number) => unknown
  /** The workbook's named styles. */
  styles?: Record<string, SheetStyle>
  /** How many rows and columns the sheet has, to keep whole rows and columns inside it. */
  size: { rows: number; cols: number }
  lang?: string
}

const TONES = new Set<string>(['neutral', 'primary', 'success', 'warning', 'danger'])
const isTone = (color: SheetColor): color is Tone => TONES.has(color)

/** A scale's color: a tone's soft fill, which follows the color mode, or the color itself. */
export function fillColor(color: SheetColor) {
  if (!isTone(color)) return color
  return color === 'neutral'
    ? 'color-mix(in oklab, var(--dou-color-text) 16%, var(--dou-color-bg-surface))'
    : `color-mix(in oklab, var(--dou-color-${color}) 32%, var(--dou-color-bg-surface))`
}

/** A bar's color: a tone's color, lighter so text stays readable over it, or the color itself. */
export function barColor(color: SheetColor) {
  if (!isTone(color)) return color
  return color === 'neutral'
    ? 'color-mix(in oklab, var(--dou-color-text) 14%, transparent)'
    : `color-mix(in oklab, var(--dou-color-${color}) 30%, transparent)`
}

/** The color `t` (0–1) of the way from `a` to `b`. */
function mix(a: string, b: string, t: number) {
  const p = Math.round(t * 100)
  if (p <= 0) return a
  if (p >= 100) return b
  return `color-mix(in oklab, ${b} ${p}%, ${a})`
}

/** A rule over one of its ranges; the ranges of a rule share its `group`. */
interface Rule {
  format: SheetConditionalFormat
  bounds: SheetBounds
  /** The cell its formula is written for. */
  anchor: { row: number; col: number }
  style?: SheetStyle
  group: RuleGroup
}

interface RuleGroup {
  areas: SheetBounds[]
  /** What the rule read of all its ranges, once. */
  stats?: Stats
  /** What the ranges' cells held when `stats` was read, as `cellStamp` gave it, row by row. */
  stamps?: unknown[]
}

type Stats =
  | { kind: 'threshold'; value: number }
  | { kind: 'counts'; counts: Map<string, number> }
  | { kind: 'spread'; min: number; mid: number; max: number }

const numberAt = (source: SheetLookSource, row: number, col: number) => {
  const value = source.valueAt(row, col)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function numbersIn(source: SheetLookSource, areas: readonly SheetBounds[]) {
  let size = 0
  for (const b of areas) size += (b.bottom - b.top + 1) * (b.right - b.left + 1)
  const list = new Float64Array(size)
  let length = 0
  for (const b of areas)
    for (let row = b.top; row <= b.bottom; row++)
      for (let col = b.left; col <= b.right; col++) {
        const n = numberAt(source, row, col)
        if (n != null) list[length++] = n
      }
  return list.subarray(0, length)
}

/**
 * The `k`th smallest of `list` (from 0), found without sorting it all:
 * `list` is reordered around it.
 */
function select(list: Float64Array, k: number) {
  let lo = 0
  let hi = list.length - 1
  while (hi > lo) {
    const pivot = list[(lo + hi) >> 1]!
    let i = lo
    let j = hi
    while (i <= j) {
      while (list[i]! < pivot) i++
      while (list[j]! > pivot) j--
      if (i <= j) {
        const t = list[i]!
        list[i++] = list[j]!
        list[j--] = t
      }
    }
    if (k <= j) hi = j
    else if (k >= i) lo = i
    else break
  }
  return list[k]!
}

/** A duplicates rule compares values as they show, without case. */
const keyOf = (source: SheetLookSource, row: number, col: number) =>
  isEmptyValue(source.valueAt(row, col)) ? '' : source.textAt(row, col).toLocaleLowerCase()

function statsOf(rule: Rule, source: SheetLookSource): Stats {
  const f = rule.format
  const { areas } = rule.group
  if ('duplicates' in f || 'unique' in f) {
    const counts = new Map<string, number>()
    for (const b of areas)
      for (let row = b.top; row <= b.bottom; row++)
        for (let col = b.left; col <= b.right; col++) {
          const key = keyOf(source, row, col)
          if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
        }
    return { kind: 'counts', counts }
  }
  const numbers = numbersIn(source, areas)
  if ('average' in f) {
    let sum = 0
    for (const n of numbers) sum += n
    return { kind: 'threshold', value: numbers.length ? sum / numbers.length : NaN }
  }
  const count = numbers.length
  if ('top' in f || 'bottom' in f) {
    const n = (f.top ?? f.bottom)!
    const wanted = f.percent
      ? Math.max(1, Math.floor((count * n) / 100))
      : Math.max(0, Math.floor(n))
    if (!wanted || !count) return { kind: 'threshold', value: NaN }
    const k = Math.min(wanted, count)
    const value = f.top != null ? select(numbers, count - k) : select(numbers, k - 1)
    return { kind: 'threshold', value }
  }
  if (!count) return { kind: 'spread', min: NaN, mid: NaN, max: NaN }
  let min = Infinity
  let max = -Infinity
  for (const n of numbers) {
    if (n < min) min = n
    if (n > max) max = n
  }
  // only a scale of three colors needs the middle
  let mid = NaN
  if ('scale' in f && f.scale.length === 3) {
    const half = count >> 1
    mid =
      count % 2 ? select(numbers, half) : (select(numbers, half - 1) + select(numbers, half)) / 2
  }
  return { kind: 'spread', min, mid, max }
}

/** A rule's look as a style: its name in `styles`, or the style itself. */
function styleOf(style: SheetConditionalStyle, styles: Record<string, SheetStyle> | undefined) {
  return typeof style === 'string' ? styles?.[style] : style
}

/** A cell's own style with the look of its conditional formats over it. */
export function layStyle(own: SheetStyle | undefined, look: SheetStyle) {
  const style = { ...look }
  if (own) addStyle(style, own)
  return style
}

/**
 * Lays `extra` under `look`: parts the look already has stay. A tone and a
 * color are one part (the text's color), as are a fill and a background.
 */
function addStyle(look: SheetStyle, extra: SheetStyle) {
  for (const key of Object.keys(extra) as (keyof SheetStyle)[]) {
    if (look[key] !== undefined || extra[key] === undefined) continue
    if ((key === 'tone' || key === 'color') && (look.tone ?? look.color) !== undefined) continue
    if ((key === 'fill' || key === 'background') && (look.fill ?? look.background) !== undefined)
      continue
    ;(look as Record<string, unknown>)[key] = extra[key]
  }
}

const sameBounds = (a: SheetBounds, b: SheetBounds) =>
  a.top === b.top && a.left === b.left && a.bottom === b.bottom && a.right === b.right
const sameAreas = (a: readonly SheetBounds[], b: readonly SheetBounds[]) =>
  a.length === b.length && a.every((area, i) => sameBounds(area, b[i]!))

/** The bounds of a range, kept inside the sheet; `null` when it isn't a range. */
export function boundsIn(text: string, size: { rows: number; cols: number }): SheetBounds | null {
  const range = parseRange(text)
  if (!range) return null
  const b = boundsOf(range)
  return {
    top: b.top,
    left: b.left,
    bottom: Math.min(b.bottom, size.rows - 1),
    right: Math.min(b.right, size.cols - 1),
  }
}

/** The ranges of a rule as a list. */
export const rangesOf = (range: SheetRuleRange): readonly string[] =>
  Array.isArray(range) ? range : [range]

/** A rule's ranges as text, such as `'E2:E9, G2:J9'`. */
export const ruleRangeText = (range: SheetRuleRange) => rangesOf(range).join(', ')

/**
 * Reads ranges written as text, separated by commas or spaces: one range
 * as a string, several as a list; `null` when one of them isn't a range.
 */
export function readRuleRange(text: string): SheetRuleRange | null {
  const texts = text
    .toUpperCase()
    .split(/[\s,，;；]+/)
    .filter(Boolean)
  if (!texts.length || texts.some((t) => !parseRange(t))) return null
  return texts.length === 1 ? texts[0]! : texts
}

/**
 * The bounds of a rule's ranges inside the sheet, leaving out those that
 * aren't ranges or lie outside it, and the cell its formula is written for:
 * the top left of the first range.
 */
export function areasIn(range: SheetRuleRange, size: { rows: number; cols: number }) {
  const areas: SheetBounds[] = []
  let anchor: { row: number; col: number } | undefined
  for (const text of rangesOf(range)) {
    const b = boundsIn(text, size)
    if (!b) continue
    anchor ??= { row: b.top, col: b.left }
    if (b.top <= b.bottom && b.left <= b.right) areas.push(b)
  }
  return { areas, anchor: anchor ?? { row: 0, col: 0 } }
}

/**
 * The looks a sheet's conditional formats give its cells. Make a new one
 * when the workbook changes; within one, each cell is worked out once.
 */
export class SheetLooks {
  private rules: Rule[] = []
  private looks = new Map<number, SheetLook | null>()
  private collator: Intl.Collator

  /**
   * `previous`, the looks before a change, lends what its rules read of
   * ranges whose rows are the same, so a change elsewhere doesn't read a
   * large range again.
   */
  constructor(
    formats: readonly SheetConditionalFormat[] | undefined,
    private source: SheetLookSource,
    previous?: SheetLooks,
  ) {
    this.collator = textCollator(source.lang)
    for (const format of formats ?? []) {
      const { areas, anchor } = areasIn(format.range, source.size)
      if (!areas.length) continue
      const style = 'style' in format ? styleOf(format.style, source.styles) : undefined
      const group: RuleGroup = { areas }
      const old = previous?.rules.find((r) => r.format === format)?.group
      if (old?.stats && old.stamps && sameAreas(old.areas, areas) && this.sameCells(old)) {
        group.stats = old.stats
        group.stamps = old.stamps
      }
      for (const bounds of areas) this.rules.push({ format, bounds, anchor, style, group })
    }
  }

  /** Whether the cells of an old rule's ranges hold what they did. */
  private sameCells(old: RuleGroup) {
    const stamp = this.source.cellStamp
    if (!stamp) return false
    const stamps = old.stamps!
    let i = 0
    for (const b of old.areas)
      for (let row = b.top; row <= b.bottom; row++)
        for (let col = b.left; col <= b.right; col++)
          if (stamp(row, col) !== stamps[i++]) return false
    return true
  }

  /** Whether there are any rules. */
  get empty() {
    return !this.rules.length
  }

  /** The columns of a row that rules cover, as `[left, right]` pairs. */
  spansIn(row: number) {
    const spans: [number, number][] = []
    for (const r of this.rules)
      if (row >= r.bounds.top && row <= r.bounds.bottom) spans.push([r.bounds.left, r.bounds.right])
    return spans
  }

  /** What the rules give a cell, or `undefined` when none applies. */
  lookAt(row: number, col: number): SheetLook | undefined {
    if (!this.rules.length) return undefined
    const pos = row * 16384 + col
    let look = this.looks.get(pos)
    if (look === undefined) {
      look = this.work(row, col)
      this.looks.set(pos, look)
    }
    return look ?? undefined
  }

  private work(row: number, col: number): SheetLook | null {
    let style: SheetStyle | undefined
    let bar: SheetLook['bar']
    for (const rule of this.rules) {
      const b = rule.bounds
      if (row < b.top || row > b.bottom || col < b.left || col > b.right) continue
      const f = rule.format
      if ('scale' in f) {
        const fill = this.scaleAt(rule, row, col)
        if (fill) addStyle((style ??= {}), { background: fill })
        continue
      }
      if ('bar' in f) {
        bar ??= this.barAt(rule, row, col)
        continue
      }
      if (rule.style && this.meets(rule, row, col)) addStyle((style ??= {}), rule.style)
    }
    if (!style && !bar) return null
    return { ...(style && { style }), ...(bar && { bar }), key: JSON.stringify([style, bar]) }
  }

  private stats(rule: Rule) {
    const group = rule.group
    if (!group.stats) {
      group.stats = statsOf(rule, this.source)
      const stamp = this.source.cellStamp
      if (stamp) {
        const stamps: unknown[] = []
        for (const b of group.areas)
          for (let row = b.top; row <= b.bottom; row++)
            for (let col = b.left; col <= b.right; col++) stamps.push(stamp(row, col))
        group.stamps = stamps
      }
    }
    return group.stats
  }

  private meets(rule: Rule, row: number, col: number): boolean {
    const f = rule.format
    const s = this.source
    if ('when' in f)
      return meetsCondition(f.when, s.valueAt(row, col), s.textAt(row, col), this.collator)
    if ('formula' in f) {
      const formula = shiftFormula(f.formula, row - rule.anchor.row, col - rule.anchor.col)
      const result = s.evaluate(formula)
      return result === true || (typeof result === 'number' && result !== 0)
    }
    if ('duplicates' in f || 'unique' in f) {
      const key = keyOf(s, row, col)
      if (!key) return false
      const stats = this.stats(rule) as Extract<Stats, { kind: 'counts' }>
      return stats.counts.get(key)! > 1 === 'duplicates' in f
    }
    const n = numberAt(s, row, col)
    if (n == null) return false
    const { value } = this.stats(rule) as Extract<Stats, { kind: 'threshold' }>
    if (Number.isNaN(value)) return false
    if ('average' in f) return f.average === 'above' ? n > value : n < value
    return 'top' in f && f.top != null ? n >= value : n <= value
  }

  private scaleAt(rule: Rule, row: number, col: number) {
    const f = rule.format as Extract<SheetConditionalFormat, { scale: unknown }>
    const n = numberAt(this.source, row, col)
    if (n == null) return undefined
    const { min, mid, max } = this.stats(rule) as Extract<Stats, { kind: 'spread' }>
    const colors = f.scale.map(fillColor)
    if (!(max > min)) return colors[colors.length === 3 ? 1 : 0]
    if (colors.length === 2) return mix(colors[0]!, colors[1]!, (n - min) / (max - min))
    return n <= mid
      ? mix(colors[0]!, colors[1]!, mid > min ? (n - min) / (mid - min) : 1)
      : mix(colors[1]!, colors[2]!, max > mid ? (n - mid) / (max - mid) : 1)
  }

  private barAt(rule: Rule, row: number, col: number): SheetLook['bar'] {
    const f = rule.format as Extract<SheetConditionalFormat, { bar: unknown }>
    const n = numberAt(this.source, row, col)
    if (n == null) return undefined
    const { min, max } = this.stats(rule) as Extract<Stats, { kind: 'spread' }>
    const lo = Math.min(0, min)
    const hi = Math.max(0, max)
    if (!(hi > lo)) return undefined
    const zero = (0 - lo) / (hi - lo)
    const at = (n - lo) / (hi - lo)
    const color = barColor(f.bar === true ? 'neutral' : f.bar)
    return { from: Math.min(zero, at), to: Math.max(zero, at), color }
  }
}
