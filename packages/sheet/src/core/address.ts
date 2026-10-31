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

/** A cell, as a name such as `'B3'` or as a point. */
export type SheetCellTarget = string | SheetPoint

/**
 * `'A1:C4'` or `'B2'` as a range; also whole columns (`'B:D'`) and whole
 * rows (`'2:3'`), which run to `Infinity` until kept inside a sheet.
 * `null` when it isn't one.
 */
export function parseRange(text: string): SheetRange | null {
  const [from, to, extra] = text.trim().split(':')
  if (extra != null || from == null) return null
  const start = parseCell(from)
  if (start) {
    const end = to == null ? start : parseCell(to)
    return end ? { start, end } : null
  }
  if (to == null) return null
  const a = from.replaceAll('$', '')
  const b = to.replaceAll('$', '')
  if (/^[a-z]+$/i.test(a) && /^[a-z]+$/i.test(b))
    return {
      start: { row: 0, col: columnIndex(a) },
      end: { row: Infinity, col: columnIndex(b) },
    }
  if (/^[1-9]\d*$/.test(a) && /^[1-9]\d*$/.test(b))
    return { start: { row: Number(a) - 1, col: 0 }, end: { row: Number(b) - 1, col: Infinity } }
  return null
}

/**
 * A range's name with its corners in order, such as `A1:C4`; one cell is
 * just its name. Given the sheet's size, whole columns read `B:D` and
 * whole rows `2:3`.
 */
export function formatRange(range: SheetRange, size?: { rows: number; cols: number }) {
  const b = boundsOf(range)
  const rows = size?.rows ?? Infinity
  const cols = size?.cols ?? Infinity
  const allRows = b.top === 0 && b.bottom >= rows - 1
  const allCols = b.left === 0 && b.right >= cols - 1
  if (allRows && !(allCols && size)) return `${columnName(b.left)}:${columnName(b.right)}`
  if (allCols && !allRows) return `${b.top + 1}:${b.bottom + 1}`
  const first = formatCell({ row: b.top, col: b.left })
  return b.top === b.bottom && b.left === b.right
    ? first
    : `${first}:${formatCell({ row: b.bottom, col: b.right })}`
}

/**
 * Splits a reference into the sheet it names and the rest: `'表 2'!A5`
 * and `表2!A5` both give `表 2` / `表2` and `A5`. Without a `!`, no sheet.
 */
export function splitSheet(text: string): { sheet?: string; ref: string } {
  const at = text.lastIndexOf('!')
  if (at === -1) return { ref: text }
  let sheet = text.slice(0, at)
  if (sheet.length > 1 && sheet.startsWith("'") && sheet.endsWith("'"))
    sheet = sheet.slice(1, -1).replaceAll("''", "'")
  return { sheet, ref: text.slice(at + 1) }
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

/*
 * A cell reference inside a formula: not part of a longer name (`LOG10(`,
 * `A1B`), and outside quoted text.
 */
const FORMULA_PART = /"(?:[^"]|"")*"|(?<![\w.$])(\$?)([a-z]{1,3})(\$?)([1-9]\d*)(?![\w(!])/gi

/**
 * A formula moved by `rows` and `cols`, as copying or filling it does:
 * references without `$` move along, `$A$1` stays. A reference pushed past
 * the first row or column becomes `#REF!`.
 */
export function shiftFormula(formula: string, rows: number, cols: number) {
  if (!formula.startsWith('=') || (rows === 0 && cols === 0)) return formula
  return formula.replace(
    FORMULA_PART,
    (match, colMark?: string, letters?: string, rowMark?: string, digits?: string) => {
      if (letters == null) return match
      const col = colMark ? columnIndex(letters) : columnIndex(letters) + cols
      const row = rowMark ? Number(digits) - 1 : Number(digits) - 1 + rows
      if (col < 0 || row < 0) return '#REF!'
      return `${colMark}${columnName(col)}${rowMark}${row + 1}`
    },
  )
}
