import { eachRef, writeRef } from '../core/address'
import { compactCell, type SheetCell, type SheetCellInput } from '../core/model'

/*
 * Formulas and ranges are written with row and column numbers, which change
 * when someone inserts or deletes lines. In the shared document each
 * reference is kept with the ids of its rows and columns besides the text,
 * so it reads right again once the lines it points at have moved, also by
 * changes this side has not seen yet when it is written.
 */

/** The ids of a sheet's rows or columns, in order, with a lookup of each one's number. */
export class SheetLines {
  private at: Map<string, number> | null = null

  constructor(public ids: string[]) {}

  /** The number of a line, `-1` when it is gone. */
  indexOf(id: string) {
    if (!this.at) {
      this.at = new Map()
      this.ids.forEach((line, index) => this.at!.set(line, index))
    }
    return this.at.get(id) ?? -1
  }

  /** Call after changing `ids`. */
  changed() {
    this.at = null
  }
}

/** A sheet as references see it: its id, its name and its lines. */
export interface LayoutSheet {
  id: string
  name: string
  rows: SheetLines
  cols: SheetLines
}

/** The sheets of a workbook, by id and by name. */
export class SheetLayout {
  readonly sheets = new Map<string, LayoutSheet>()

  byName(name: string) {
    for (const sheet of this.sheets.values()) if (sheet.name === name) return sheet
    return undefined
  }
}

/** One end of a reference: a line id, a number past the sheet's lines, or `null` for none (`B:B` has no row). */
type End = string | number | null

/**
 * A reference held by ids: the sheet it names (`null`: the formula's own
 * sheet), then the rows and columns of its two ends. `0` for a reference
 * to a sheet that isn't there, kept as written.
 */
export type AnchoredRef = 0 | [sheet: string | null, rowA: End, colA: End, rowB: End, colB: End]

/** Text with references, and their anchors in the order they come. */
export interface AnchoredText {
  t: string
  r?: AnchoredRef[]
}

/** The anchors of a formula's references, or `undefined` when it has none to keep. */
export function anchorFormula(
  formula: string,
  here: LayoutSheet,
  layout: SheetLayout,
): AnchoredRef[] | undefined {
  const refs: AnchoredRef[] = []
  let any = false
  eachRef(formula, (named, a, b, text) => {
    const target = named == null ? here : layout.byName(named)
    if (!target) {
      refs.push(0)
      return text
    }
    any = true
    const row = (n?: number): End => (n == null ? null : (target.rows.ids[n] ?? n))
    const col = (n?: number): End => (n == null ? null : (target.cols.ids[n] ?? n))
    refs.push([named == null ? null : target.id, row(a.row), col(a.col), row(b.row), col(b.col)])
    return text
  })
  return any ? refs : undefined
}

/** The number of a line: its id's place, `-1` when it is gone, or the number kept for one past the ids. */
export function lineOf(lines: SheetLines, end: string | number): number
export function lineOf(lines: SheetLines, end: End): number | undefined
export function lineOf(lines: SheetLines, end: End) {
  return end == null ? undefined : typeof end === 'number' ? end : lines.indexOf(end)
}

/**
 * A formula with its references where their lines are now. A reference
 * whose line or sheet is gone reads `#REF!`; one whose sheet was renamed
 * names it anew. Unchanged references keep their text as written.
 */
export function resolveFormula(
  formula: string,
  refs: readonly AnchoredRef[],
  here: LayoutSheet,
  layout: SheetLayout,
) {
  let i = 0
  return eachRef(formula, (named, a, b, text) => {
    const ref = refs[i++]
    if (!ref) return text
    const [sheetId, rowA, colA, rowB, colB] = ref
    const target = sheetId == null ? here : layout.sheets.get(sheetId)
    if (!target) return '#REF!'
    const renamed = named != null && target.name !== named
    const prefix = renamed
      ? undefined
      : text.includes('!')
        ? text.slice(0, text.lastIndexOf('!') + 1)
        : undefined
    const r1 = lineOf(target.rows, rowA)
    const c1 = lineOf(target.cols, colA)
    const r2 = lineOf(target.rows, rowB)
    const c2 = lineOf(target.cols, colB)
    if (r1 === -1 || c1 === -1 || r2 === -1 || c2 === -1)
      return `${prefix ?? (named != null ? `${target.name}!` : '')}#REF!`
    if (!renamed && r1 === a.row && c1 === a.col && r2 === b.row && c2 === b.col) return text
    const single = a === b
    const from = { ...a, row: r1, col: c1 }
    const to = single ? from : { ...b, row: r2, col: c2 }
    return writeRef(named == null ? undefined : target.name, from, to, single, prefix)
  })
}

/** A range such as `A1:C4`, anchored. */
export function anchorRange(range: string, here: LayoutSheet, layout: SheetLayout): AnchoredText {
  const r = anchorFormula(`=${range}`, here, layout)
  return r ? { t: range, r } : { t: range }
}

/** A range where its lines are now; `null` when they are gone. */
export function resolveRange(stored: AnchoredText, here: LayoutSheet, layout: SheetLayout) {
  if (!stored.r) return stored.t
  const text = resolveFormula(`=${stored.t}`, stored.r, here, layout).slice(1)
  return text.includes('#REF!') ? null : text
}

/** A formula, or text that may be one, anchored. */
export function anchorText(text: string, here: LayoutSheet, layout: SheetLayout): AnchoredText {
  const r = text.startsWith('=') ? anchorFormula(text, here, layout) : undefined
  return r ? { t: text, r } : { t: text }
}

export function resolveText(stored: AnchoredText, here: LayoutSheet, layout: SheetLayout) {
  return stored.r ? resolveFormula(stored.t, stored.r, here, layout) : stored.t
}

/** Where a cell keeps the anchors of its formula in the shared document. */
export const REFS = '$refs'

const isFormula = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('=')

/** A cell as the shared document keeps it: as it is, with the anchors of its formula beside. */
export function anchorCell(cell: SheetCellInput, here: LayoutSheet, layout: SheetLayout): unknown {
  const value = typeof cell === 'object' && cell !== null ? cell.value : cell
  if (!isFormula(value)) return cell ?? undefined
  const refs = anchorFormula(value, here, layout)
  if (!refs) return cell
  const fields = typeof cell === 'object' && cell !== null ? cell : { value }
  return { ...fields, [REFS]: refs }
}

/** Whether a cell kept in the shared document has references to resolve. */
export const hasRefs = (stored: unknown): stored is SheetCell & { [REFS]: AnchoredRef[] } =>
  typeof stored === 'object' && stored !== null && REFS in stored

/** A cell kept in the shared document, with its formula's references where they are now. */
export function resolveCell(stored: unknown, here: LayoutSheet, layout: SheetLayout) {
  if (!hasRefs(stored)) return stored as SheetCellInput
  const { [REFS]: refs, ...cell } = stored
  if (isFormula(cell.value)) cell.value = resolveFormula(cell.value, refs, here, layout)
  return compactCell(cell)
}
