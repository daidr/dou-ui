import { boundsOf, parseRange } from './address'
import { resolveSheetExtensions, type SheetExtension } from './extension'
import { overlaps } from './merge'
import type { SheetBounds } from './address'
import type { SheetData, SheetWorkbook } from './model'
import { plainCellTypes } from './plain-cell-types'

export interface WorkbookProblem {
  code:
    | 'version'
    | 'missing-name'
    | 'duplicate-name'
    | 'duplicate-id'
    | 'unknown-style'
    | 'unknown-type'
    | 'bad-merge'
  /** The name of the sheet at fault; none for the workbook's own problems. */
  sheet?: string
  /**
   * Where the problem is, as a path into the workbook, e.g. `sheets[1]`,
   * `sheets[0].cells[3][2]` or `types.status`; `version` for the version.
   */
  path: string
  /** The name, style, type or range at fault, for the editor's message. */
  text: string
  /** An English description, for logs. */
  message: string
}

export interface CheckWorkbookOptions {
  /**
   * The sheet's `extensions`, for the cell types they add. Without them only
   * the built-in types (`date`, `select`, `checkbox`) and the workbook's own
   * `types` are known.
   */
  extensions?: readonly (SheetExtension | readonly SheetExtension[])[]
}

/**
 * The problems of a workbook, before it is saved or shown: an unknown
 * version, sheets without a name or sharing a name or id, cells using a
 * style or type nobody defined, and merges that are not ranges or overlap
 * another.
 */
export function checkWorkbook(
  workbook: SheetWorkbook,
  options: CheckWorkbookOptions = {},
): WorkbookProblem[] {
  const problems: WorkbookProblem[] = []
  if (workbook.version !== 1)
    problems.push({
      code: 'version',
      path: 'version',
      text: String(workbook.version),
      message: `Version ${String(workbook.version)} is not known`,
    })
  const cellTypes = new Set(plainCellTypes.map((type) => type.name))
  for (const type of resolveSheetExtensions(options.extensions).cellTypes) cellTypes.add(type.name)
  for (const [name, setup] of Object.entries(workbook.types ?? {}))
    if (!cellTypes.has(setup?.type))
      problems.push({
        code: 'unknown-type',
        path: `types.${name}`,
        text: String(setup?.type),
        message: `The type "${name}" sets up "${String(setup?.type)}", which no one defines`,
      })
  const styles = new Set(Object.keys(workbook.styles ?? {}))
  const types = new Set([...cellTypes, ...Object.keys(workbook.types ?? {})])

  const names = new Set<string>()
  const ids = new Set<string>()
  workbook.sheets.forEach((sheet, i) => {
    const path = `sheets[${i}]`
    if (!sheet.name)
      problems.push({ code: 'missing-name', path, text: '', message: `${path} has no name` })
    else if (names.has(sheet.name))
      problems.push({
        code: 'duplicate-name',
        sheet: sheet.name,
        path,
        text: sheet.name,
        message: `The sheet name "${sheet.name}" is used more than once`,
      })
    names.add(sheet.name)
    if (sheet.id !== undefined) {
      if (ids.has(sheet.id))
        problems.push({
          code: 'duplicate-id',
          sheet: sheet.name,
          path,
          text: sheet.id,
          message: `The sheet id "${sheet.id}" is used more than once`,
        })
      ids.add(sheet.id)
    }
    checkCells(sheet, path, styles, types, problems)
    checkMerges(sheet, path, problems)
  })
  return problems
}

function checkCells(
  sheet: SheetData,
  path: string,
  styles: Set<string>,
  types: Set<string>,
  problems: WorkbookProblem[],
) {
  sheet.cells.forEach((row, r) =>
    row?.forEach((cell, c) => {
      if (!cell || typeof cell !== 'object') return
      const at = `${path}.cells[${r}][${c}]`
      if (cell.style !== undefined && !styles.has(cell.style))
        problems.push({
          code: 'unknown-style',
          sheet: sheet.name,
          path: at,
          text: cell.style,
          message: `No style "${cell.style}" is in the workbook's styles`,
        })
      if (cell.type !== undefined && !types.has(cell.type))
        problems.push({
          code: 'unknown-type',
          sheet: sheet.name,
          path: at,
          text: cell.type,
          message: `No cell type "${cell.type}" is defined`,
        })
    }),
  )
}

function checkMerges(sheet: SheetData, path: string, problems: WorkbookProblem[]) {
  const seen: SheetBounds[] = []
  sheet.merges?.forEach((text, m) => {
    const range = typeof text === 'string' ? parseRange(text) : null
    const bounds = range && boundsOf(range)
    const whole = bounds && Number.isFinite(bounds.bottom) && Number.isFinite(bounds.right)
    const clash = whole && seen.some((other) => overlaps(other, bounds))
    if (whole && !clash) {
      seen.push(bounds)
      return
    }
    problems.push({
      code: 'bad-merge',
      sheet: sheet.name,
      path: `${path}.merges[${m}]`,
      text: String(text),
      message: clash
        ? `The merge "${text}" overlaps another one`
        : `The merge "${String(text)}" is not a range of cells`,
    })
  })
}

/**
 * Brings a saved workbook up to the current version, and fills what an
 * older or hand-written one may lack (`version`, `sheets`, each sheet's
 * `cells`). Sheets that are not objects are dropped; anything else is kept
 * as it is. Throws for a version newer than this one knows.
 */
export function migrateWorkbook(input: unknown): SheetWorkbook {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const version = source.version ?? 1
  if (version !== 1) throw new Error(`Workbook version ${String(version)} is not known`)
  const sheets: SheetData[] = []
  for (const value of Array.isArray(source.sheets) ? source.sheets : []) {
    if (!value || typeof value !== 'object') continue
    const sheet = value as Record<string, unknown>
    sheets.push({
      ...sheet,
      name: String(sheet.name ?? ''),
      cells: Array.isArray(sheet.cells) ? sheet.cells : [],
    } as SheetData)
  }
  return { ...source, version: 1, sheets } as SheetWorkbook
}
