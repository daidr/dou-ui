/*
 * Cells are addressed by zero-based row and column numbers in code, and
 * by "A1" names wherever people read or write them.
 */

/** A cell, by zero-based row and column. */
export interface SheetPoint {
  row: number
  col: number
}

/**
 * A rectangle of cells between two corners. `start` is where the range was
 * started (the anchor), so it may be below or right of `end`.
 */
export interface SheetRange {
  start: SheetPoint
  end: SheetPoint
}

/** A range with its edges in order: `top <= bottom`, `left <= right`. */
export interface SheetBounds {
  top: number
  left: number
  bottom: number
  right: number
}

/** A column's letters: 0 is `A`, 25 is `Z`, 26 is `AA`. */
export function columnName(col: number) {
  let name = ''
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

/** A column's number from its letters, any case; `-1` when they aren't letters. */
export function columnIndex(name: string) {
  if (!/^[a-z]+$/i.test(name)) return -1
  let col = 0
  for (const char of name.toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64
  return col - 1
}

const CELL = /^\$?([a-z]+)\$?([1-9]\d*)$/i

/** `'B3'` as `{ row: 2, col: 1 }`; `$` marks are allowed. `null` when it isn't a cell name. */
export function parseCell(name: string): SheetPoint | null {
  const match = CELL.exec(name.trim())
  if (!match) return null
  return { row: Number(match[2]) - 1, col: columnIndex(match[1]!) }
}

/** A cell's name, such as `B3`. */
export const formatCell = (point: SheetPoint) => `${columnName(point.col)}${point.row + 1}`

/** `'A1:C4'` or `'B2'` as a range. `null` when it isn't one. */
export function parseRange(text: string): SheetRange | null {
  const [from, to, extra] = text.split(':')
  if (extra != null || from == null) return null
  const start = parseCell(from)
  const end = to == null ? start : parseCell(to)
  return start && end ? { start, end } : null
}

/** A range's name with its corners in order, such as `A1:C4`; one cell is just its name. */
export function formatRange(range: SheetRange) {
  const b = boundsOf(range)
  const first = formatCell({ row: b.top, col: b.left })
  return b.top === b.bottom && b.left === b.right
    ? first
    : `${first}:${formatCell({ row: b.bottom, col: b.right })}`
}

export function boundsOf(range: SheetRange): SheetBounds {
  const { start, end } = range
  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.col, end.col),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.col, end.col),
  }
}

export const inBounds = (b: SheetBounds, row: number, col: number) =>
  row >= b.top && row <= b.bottom && col >= b.left && col <= b.right

/** A range of one cell. */
export const pointRange = (point: SheetPoint): SheetRange => ({ start: point, end: point })
