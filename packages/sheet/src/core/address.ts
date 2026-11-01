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
 * References inside formulas. Formulas are kept as text, so moving cells
 * around rewrites the references in them, the way copying, inserting and
 * deleting do in other spreadsheet programs.
 */

/** One end of a reference: a column, a row or both, each maybe fixed with `$`. */
export interface RefEnd {
  col?: number
  row?: number
  colMark: boolean
  rowMark: boolean
}

/**
 * A reference: `A1`, `A1:C4`, `B:D`, `2:3`, maybe after a sheet
 * (`表2!A1`, `'表 2'!A1`). Not part of a longer name (`LOG10(`, `A1B`),
 * and quoted text is skipped whole.
 */
const REF = new RegExp(
  [
    '"(?:[^"]|"")*"',
    "(?<![\\p{L}\\p{N}_.$'!])" +
      "(?:('(?:[^']|'')+'|[\\p{L}_][\\p{L}\\p{N}_.]*)!)?" +
      '(?:(\\$?[a-z]{1,3}\\$?[1-9]\\d*)(?::(\\$?[a-z]{1,3}\\$?[1-9]\\d*))?' +
      '|(\\$?[a-z]{1,3}):(\\$?[a-z]{1,3})' +
      '|(\\$?[1-9]\\d*):(\\$?[1-9]\\d*))' +
      '(?![\\p{L}\\p{N}_(!])',
  ].join('|'),
  'giu',
)

function readEnd(text: string): RefEnd {
  const match = /^(\$?)([a-z]*)(\$?)(\d*)$/i.exec(text)!
  const end: RefEnd = { colMark: false, rowMark: false }
  if (match[2]) {
    end.col = columnIndex(match[2])
    end.colMark = match[1] === '$'
    if (match[4]) {
      end.row = Number(match[4]) - 1
      end.rowMark = match[3] === '$'
    }
  } else {
    end.row = Number(match[4]) - 1
    end.rowMark = match[1] === '$' || match[3] === '$'
  }
  return end
}

function writeEnd(end: RefEnd) {
  let text = ''
  if (end.col != null) text += `${end.colMark ? '$' : ''}${columnName(end.col)}`
  if (end.row != null) text += `${end.rowMark ? '$' : ''}${end.row + 1}`
  return text
}

/** A sheet's name as a reference writes it: quoted unless it is a plain word. */
export function quoteSheet(name: string) {
  // names that read as a cell, `AB12` or `R1C1`, are quoted too
  return /^[\p{L}_][\p{L}\p{N}_.]*$/u.test(name) &&
    !parseCell(name) &&
    !/^[rc]\d*([rc]\d*)?$/i.test(name)
    ? name
    : `'${name.replaceAll("'", "''")}'`
}

/**
 * Calls `map` for every reference in a formula, with its sheet (as
 * written, unquoted) and its two ends, and puts back the text it returns.
 */
export function eachRef(
  formula: string,
  map: (sheet: string | undefined, a: RefEnd, b: RefEnd, text: string) => string,
) {
  if (!formula.startsWith('=')) return formula
  return formula.replace(REF, (match, sheet?: string, ...parts: (string | undefined)[]) => {
    const found = parts.slice(0, 6).filter((part) => part != null)
    if (!found.length) return match
    const at = sheet ? splitSheet(`${sheet}!`).sheet : undefined
    const a = readEnd(found[0]!)
    const b = found[1] ? readEnd(found[1]) : a
    return map(at, a, b, match)
  })
}

export function writeRef(
  sheet: string | undefined,
  a: RefEnd,
  b: RefEnd,
  single: boolean,
  written?: string,
) {
  const prefix = written ?? (sheet != null ? `${quoteSheet(sheet)}!` : '')
  return single ? prefix + writeEnd(a) : `${prefix}${writeEnd(a)}:${writeEnd(b)}`
}

/** One end of a reference moved by `rows` and `cols`, unless fixed; `null` past the first row or column. */
function shiftEnd(end: RefEnd, rows: number, cols: number): RefEnd | null {
  const next = { ...end }
  if (next.col != null && !next.colMark) next.col += cols
  if (next.row != null && !next.rowMark) next.row += rows
  return (next.col ?? 0) < 0 || (next.row ?? 0) < 0 ? null : next
}

/**
 * A formula moved by `rows` and `cols`, as copying or filling it does:
 * references without `$` move along, `$A$1` stays. A reference pushed past
 * the first row or column becomes `#REF!`.
 */
export function shiftFormula(formula: string, rows: number, cols: number) {
  if (rows === 0 && cols === 0) return formula
  return eachRef(formula, (sheet, a, b, text) => {
    const single = a === b
    const from = shiftEnd(a, rows, cols)
    const to = single ? from : shiftEnd(b, rows, cols)
    if (!from || !to)
      return text.includes('!') ? `${text.slice(0, text.lastIndexOf('!') + 1)}#REF!` : '#REF!'
    return writeRef(sheet, from, to, single)
  })
}

/**
 * Where the cells of a range are after a change to a sheet: the same
 * bounds, new bounds, bounds on another sheet, or `null` when they are
 * gone. Whole columns run from row 0 to `Infinity`, whole rows likewise.
 */
export type SheetRefMap = (
  bounds: SheetBounds,
) => SheetBounds | { sheet: string; bounds: SheetBounds } | null

/**
 * Rewrites the references in a formula on sheet `here` that point at cells
 * on sheet `sheet`, by `map`: references to cells that moved follow them,
 * references to cells that are gone become `#REF!`. Unlike copying, fixed
 * references (`$A$1`) move too.
 */
export function moveReferences(formula: string, here: string, sheet: string, map: SheetRefMap) {
  return eachRef(formula, (named, a, b, text) => {
    if ((named ?? here) !== sheet) return text
    const single = a === b
    const bounds: SheetBounds = {
      top: Math.min(a.row ?? 0, b.row ?? 0),
      left: Math.min(a.col ?? 0, b.col ?? 0),
      bottom: a.row == null ? Infinity : Math.max(a.row, b.row!),
      right: a.col == null ? Infinity : Math.max(a.col, b.col!),
    }
    const result = map(bounds)
    const prefix = text.includes('!') ? text.slice(0, text.lastIndexOf('!') + 1) : ''
    if (!result) return `${prefix}#REF!`
    const next = 'bounds' in result ? result.bounds : result
    const to = 'bounds' in result ? result.sheet : (named ?? here)
    const same =
      to === (named ?? here) &&
      next.top === bounds.top &&
      next.left === bounds.left &&
      next.bottom === bounds.bottom &&
      next.right === bounds.right
    if (same) return text
    // a reference that now points at another sheet names it; one that named its sheet keeps how
    const out = to === here && named == null ? undefined : to
    const keep = named != null && to === named ? prefix : undefined
    const first = (a.row ?? Infinity) <= (b.row ?? Infinity)
    const left = (a.col ?? Infinity) <= (b.col ?? Infinity)
    const end = (base: RefEnd, top: boolean, l: boolean): RefEnd => ({
      ...base,
      col: base.col == null ? undefined : l ? next.left : next.right,
      row: base.row == null ? undefined : top ? next.top : next.bottom,
    })
    return writeRef(out, end(a, first, left), end(b, !first, !left), single, keep)
  })
}

/**
 * A formula with its references to sheet `from` naming sheet `to`
 * instead, as renaming a sheet does. References without a sheet stay as
 * they are, also in a formula on the renamed sheet itself.
 */
export function renameReferences(formula: string, from: string, to: string) {
  if (from === to) return formula
  return eachRef(formula, (named, a, b, text) =>
    named === from ? writeRef(to, a, b, a === b) : text,
  )
}

/**
 * A formula with references to several sheets renamed at once, by old
 * name: `{ 预算: '预算 (2)' }`. Names that swap or chain are each renamed
 * once. A name mapped to itself has its references written again, quoted
 * as `quoteSheet` quotes it.
 */
export function renameReferencesAll(formula: string, names: ReadonlyMap<string, string>) {
  if (!names.size) return formula
  return eachRef(formula, (named, a, b, text) => {
    const to = named == null ? undefined : names.get(named)
    return to != null ? writeRef(to, a, b, a === b) : text
  })
}

/** A formula with its references to sheet `sheet`, which is gone, reading `#REF!`. */
export function dropReferences(formula: string, sheet: string) {
  return eachRef(formula, (named, _a, _b, text) => (named === sheet ? '#REF!' : text))
}
