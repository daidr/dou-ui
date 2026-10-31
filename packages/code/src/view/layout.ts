import type { ChangeSet } from '../core/changes'
import { clusterStarts, isAscii } from '../core/chars'
import { type CodeText, splitLines } from '../core/text'
import type { Measure } from './measure'

/** How a line is cut into rows: where each row after the first starts, and how far those rows are indented. */
export interface WrappedLine {
  readonly breaks: readonly number[]
  readonly indent: number
}

export const UNWRAPPED: WrappedLine = Object.freeze({ breaks: Object.freeze([]), indent: 0 })

const isSpace = (ch: string) => ch === ' ' || ch === '\t'
/** Punctuation a row may end after, so long code breaks between its parts rather than inside a name. */
const AFTER = '([{,;'
/** Surrogate pairs, combining marks and joiners: characters made of several code units. */
const COMPLEX = /[\p{M}\u200d\ud800-\udfff]/u
/** Scripts written without spaces, which may break between any two characters. */
const WIDE = /[⺀-꓏가-힣豈-﫿︰-﹏＀-｠]/

/**
 * Cuts a line into rows no wider than `width`. Rows break after spaces and
 * opening brackets, commas and semicolons, before a `.`, or between
 * characters of scripts written without spaces; a word longer than
 * a row is cut where it overflows. Rows after the first line up with the
 * line's indentation, unless that leaves too little room.
 */
export function wrapLine(text: string, width: number, measure: Measure): WrappedLine {
  if (!text) return UNWRAPPED
  const ascii = isAscii(text)
  // Wide characters take about two cells; a line that fits even so needs no closer look.
  if (!text.includes('\t') && text.length * measure.cell * (ascii ? 1 : 2) <= width)
    return UNWRAPPED
  const stop = measure.cell * measure.tabSize
  let lead = 0
  let indent = 0
  for (; lead < text.length && isSpace(text[lead]!); lead++)
    indent =
      text[lead] === '\t' ? (Math.floor(indent / stop + 1e-6) + 1) * stop : indent + measure.cell
  if (indent > width / 2) indent = 0

  // Each UTF-16 unit is a character of its own unless the line has pairs or marks; finding clusters is slow.
  const single = ascii || !COMPLEX.test(text)
  const starts = single ? null : clusterStarts(text)
  const count = single ? text.length : starts!.length - 1
  const breaks: number[] = []
  let x = 0
  let rowStart = 0
  let rowX = 0
  let limit = width
  /** Where the current row may end at the latest, and the x there. */
  let chance = -1
  let chanceX = 0
  for (let i = 0; i < count; i++) {
    const from = single ? i : starts![i]!
    const to = single ? i + 1 : starts![i + 1]!
    const ch = single ? text[i]! : text.slice(from, to)
    const w =
      ch === '\t'
        ? (Math.floor(x / stop + 1e-6) + 1) * stop - x
        : ascii
          ? measure.cell
          : measure.width(ch)
    const wide = !ascii && WIDE.test(ch)
    // A wide character or a `.` (a member access) may start a row, so the row can end before it.
    if ((wide || ch === '.') && from > rowStart) {
      chance = from
      chanceX = x
    }
    while (x + w - rowX > limit && from > rowStart) {
      const at = chance > rowStart ? chance : from
      const atX = chance > rowStart ? chanceX : x
      breaks.push(at)
      rowStart = at
      rowX = atX
      limit = width - indent
      chance = -1
    }
    x += w
    if (isSpace(ch) || wide || AFTER.includes(ch)) {
      chance = to
      chanceX = x
    }
  }
  return breaks.length ? { breaks, indent } : UNWRAPPED
}

/** The row of a line that column `col` is drawn on. A column right at a break starts the next row. */
export function rowOfCol(wrapped: WrappedLine, col: number): number {
  const { breaks } = wrapped
  let row = 0
  while (row < breaks.length && breaks[row]! <= col) row++
  return row
}

/**
 * Where each line sits, counted in rows: a wrapped line takes several and a
 * folded line none. When every line is one row, nothing is stored and the
 * answers are plain arithmetic.
 */
export class LineLayout {
  /** Rows before each line, as a Fenwick tree over the rows of each line. */
  private tree: Int32Array | null = null
  private rows: Int32Array | null = null
  readonly total: number

  constructor(
    readonly lines: number,
    /** Rows of each line (index `n - 1`), or `null` when none wraps. */
    wrapRows: ArrayLike<number> | null,
    /** Hidden lines, as sorted inclusive ranges. */
    hidden: ReadonlyArray<readonly [number, number]>,
  ) {
    if (!wrapRows && !hidden.length) {
      this.total = lines
      return
    }
    const rows = new Int32Array(lines)
    if (wrapRows) for (let i = 0; i < lines; i++) rows[i] = wrapRows[i] ?? 1
    else rows.fill(1)
    for (const [from, to] of hidden)
      for (let n = Math.max(1, from); n <= Math.min(lines, to); n++) rows[n - 1] = 0
    // Build the tree in O(n): each node adds itself to its parent.
    const tree = new Int32Array(lines + 1)
    let total = 0
    for (let i = 1; i <= lines; i++) {
      tree[i]! += rows[i - 1]!
      total += rows[i - 1]!
      const parent = i + (i & -i)
      if (parent <= lines) tree[parent]! += tree[i]!
    }
    this.rows = rows
    this.tree = tree
    this.total = Math.max(1, total)
  }

  /** Whether every line is one row. */
  get uniform() {
    return !this.tree
  }

  /** How many rows line `n` takes; `0` when it is hidden. */
  rowsOf(n: number): number {
    return this.rows ? (this.rows[n - 1] ?? 0) : 1
  }

  /** The row line `n` starts on, from 0. */
  rowOf(n: number): number {
    if (!this.tree) return n - 1
    let sum = 0
    for (let i = Math.min(n - 1, this.lines); i > 0; i -= i & -i) sum += this.tree[i]!
    return sum
  }

  /** The line drawn on row `row`, and which of its rows that is; clamped to the text. */
  lineAtRow(row: number): { n: number; sub: number } {
    row = Math.max(0, Math.min(Math.floor(row), this.total - 1))
    if (!this.tree) return { n: Math.min(this.lines, row + 1), sub: 0 }
    // The last line whose start is at or before `row`, skipping lines that take no rows.
    let pos = 0
    let rest = row
    let step = 1
    while (step * 2 <= this.lines) step *= 2
    for (; step; step >>= 1) {
      const next = pos + step
      if (next <= this.lines && this.tree[next]! <= rest) {
        pos = next
        rest -= this.tree[next]!
      }
    }
    // `pos` lines fit entirely before `row`; the row is in line `pos + 1`.
    return { n: Math.min(this.lines, pos + 1), sub: rest }
  }

  /** Whether line `n` is drawn. */
  shown(n: number): boolean {
    return !this.rows || this.rows[n - 1]! > 0
  }
}

/**
 * Moves per-line values (rows of each line) along with an edit, working
 * out `valueOf` again only for the lines it touched. Returns `false` when
 * starting over is cheaper or the values no longer fit the text.
 */
export function updateRows(
  rows: number[],
  before: CodeText,
  after: CodeText,
  changes: ChangeSet,
  valueOf: (text: string) => number,
): boolean {
  if (rows.length !== before.lines) return false
  // Changes on the same lines (several cursors on one line) are one group of old lines.
  const groups: Array<{ first: number; last: number; added: number }> = []
  for (const change of changes.changes) {
    const first = before.lineAt(change.from).number
    const last = before.lineAt(change.to).number
    const added = splitLines(change.insert).length - 1 - (last - first)
    const group = groups[groups.length - 1]
    if (group && first <= group.last) {
      group.last = Math.max(group.last, last)
      group.added += added
    } else groups.push({ first, last, added })
  }
  let shift = 0
  const placed = groups.map((group) => {
    const from = group.first + shift
    shift += group.added
    return from
  })
  // From the last group back, so the line numbers of earlier ones still hold.
  for (let i = groups.length - 1; i >= 0; i--) {
    const { first, last, added } = groups[i]!
    const count = last - first + 1 + added
    if (count > 5000) return false
    const texts = after.lineTexts(placed[i]!, placed[i]! + count - 1)
    rows.splice(first - 1, last - first + 1, ...texts.map(valueOf))
  }
  return rows.length === after.lines
}
