import {
  cellOf,
  type SheetCell,
  type SheetData,
  type SheetProtection,
  type SheetWorkbook,
} from './model'
import { SheetTransaction, type SheetStep } from './transaction'

/*
 * Protection. A protected sheet keeps its locked cells, its lines and its
 * rules as they are; a protected workbook keeps its sheets. The grid checks
 * every change it makes against the workbook as it was, and cancels the
 * ones that would change what is protected.
 */

/** Why a change to a protected sheet or workbook isn't allowed. */
export type SheetProtectionRefusal =
  /** It changes what a locked cell holds. */
  | 'cell'
  /** It changes the look or number format of a locked cell, or merges cells. */
  | 'format'
  /** It locks or unlocks cells. */
  | 'lock'
  | 'formatRows'
  | 'formatColumns'
  | 'insertRows'
  | 'insertColumns'
  | 'deleteRows'
  | 'deleteColumns'
  | 'filter'
  /** It changes the sheet's rules, groups or other settings. */
  | 'sheet'
  /** It adds, removes, moves or renames a sheet of a protected workbook. */
  | 'structure'

/** What a refused change runs into: the reason, the sheet and, for a cell, where it is. */
export interface SheetProtectionCheck {
  reason: SheetProtectionRefusal
  /** The sheet's key. */
  sheet?: string
  row?: number
  col?: number
}

const NONE: SheetProtection = {}

/** A sheet's protection, `null` when it isn't protected. */
export function protectionOf(sheet: SheetData | undefined): SheetProtection | null {
  const protect = sheet?.protect
  if (!protect) return null
  return protect === true ? NONE : protect
}

/** Whether a cell is locked: unless its style says `locked: false`. */
export function isLocked(cell: SheetCell | undefined, book: SheetWorkbook) {
  const name = cell?.style
  return !name || book.styles?.[name]?.locked !== false
}

/** Whether anything in the workbook is protected, so changes need checking. */
export function hasProtection(book: SheetWorkbook) {
  return !!book.protect || book.sheets.some((sheet) => !!sheet.protect)
}

/** A cell's fields besides its look. */
const sameContent = (a: SheetCell | undefined, b: SheetCell | undefined) =>
  a?.value === b?.value && a?.type === b?.type && a?.note === b?.note && a?.link === b?.link

/** Sheet fields that change freely on a protected sheet: lines added are checked as steps. */
const FREE_FIELDS = new Set(['protect', 'freeze', 'rowCount', 'colCount'])

/**
 * Checks a change against the protection of the workbook it started from,
 * step by step, so each step meets the cells as they were when it ran. Gives
 * the first thing that isn't allowed, or `null` when all of it is.
 */
export function checkProtection(tr: SheetTransaction): SheetProtectionCheck | null {
  // a change that turns protection on is checked from there
  if (!hasProtection(tr.before) && !hasProtection(tr.doc)) return null
  const replay = new SheetTransaction(tr.before)
  // once lines move or a sheet is renamed, formulas and rules follow them
  let moved = false
  for (const step of tr.steps) {
    const refusal = checkStep(step, replay.doc, moved)
    if (refusal) return refusal
    if (MOVING.has(step.type) || (step.type === 'updateSheet' && 'name' in step.patch)) moved = true
    replay.step(step)
  }
  return null
}

const MOVING = new Set<SheetStep['type']>(['insertLines', 'removeLines', 'moveLines'])
/** Sheet fields whose references follow lines that move. */
const FOLLOWING = new Set(['merges', 'filter', 'groups', 'conditionalFormats', 'validations'])

const isFormula = (cell: SheetCell | undefined) =>
  typeof cell?.value === 'string' && cell.value.startsWith('=')

/** Whether a cell only had its formula's references moved along, all else kept. */
const followed = (a: SheetCell | undefined, b: SheetCell | undefined) =>
  isFormula(a) &&
  isFormula(b) &&
  a?.style === b?.style &&
  a?.format === b?.format &&
  sameContent({ ...a, value: undefined }, { ...b, value: undefined })

function sheetOf(book: SheetWorkbook, key: string) {
  return book.sheets.find((sheet) => (sheet.id ?? sheet.name) === key)
}

function checkStep(
  step: SheetStep,
  book: SheetWorkbook,
  moved: boolean,
): SheetProtectionCheck | null {
  switch (step.type) {
    case 'updateBook':
      return null
    case 'setType':
      return null
    case 'setStyle': {
      // a style changed in place locks or unlocks every cell using it
      const old = book.styles?.[step.name]
      if (!old || (old.locked !== false) === (step.style?.locked !== false)) return null
      return book.sheets.some((sheet) => sheet.protect) ? { reason: 'lock' } : null
    }
    case 'insertSheet':
    case 'removeSheet':
    case 'moveSheet':
      return book.protect ? { reason: 'structure' } : null
    default:
      break
  }
  const sheet = sheetOf(book, step.sheet)
  if (step.type === 'updateSheet' && book.protect && 'name' in step.patch)
    if (step.patch.name !== sheet?.name) return { reason: 'structure', sheet: step.sheet }
  const protect = protectionOf(sheet)
  if (!protect || !sheet) return null
  const at = { sheet: step.sheet }
  switch (step.type) {
    case 'setCell': {
      const old = cellOf(sheet.cells[step.row]?.[step.col])
      const next = cellOf(step.cell)
      const where = { ...at, row: step.row, col: step.col }
      const locked = isLocked(old, book)
      if (locked !== isLocked(next, book)) return { reason: 'lock', ...where }
      if (!locked || (moved && followed(old, next))) return null
      if (!sameContent(old, next)) return { reason: 'cell', ...where }
      return protect.formatCells ? null : { reason: 'format', ...where }
    }
    case 'setSize':
      if (step.axis === 'row') return protect.formatRows ? null : { reason: 'formatRows', ...at }
      return protect.formatColumns ? null : { reason: 'formatColumns', ...at }
    case 'insertLines':
      if (step.axis === 'row') return protect.insertRows ? null : { reason: 'insertRows', ...at }
      return protect.insertColumns ? null : { reason: 'insertColumns', ...at }
    case 'removeLines':
      if (step.axis === 'row') return protect.deleteRows ? null : { reason: 'deleteRows', ...at }
      return protect.deleteColumns ? null : { reason: 'deleteColumns', ...at }
    case 'moveLines':
      return { reason: 'sheet', ...at }
    case 'updateSheet': {
      for (const key of Object.keys(step.patch) as (keyof typeof step.patch)[]) {
        // a rename is the workbook's to allow
        if (FREE_FIELDS.has(key) || key === 'name' || sheet[key] === step.patch[key]) continue
        if (moved && FOLLOWING.has(key)) continue
        if (key === 'filter') {
          if (!protect.filter) return { reason: 'filter', ...at }
          continue
        }
        if (key === 'merges') {
          if (!protect.formatCells) return { reason: 'format', ...at }
          continue
        }
        // folding and unfolding the groups there are
        if (key === 'groups' && sameGroups(sheet.groups, step.patch.groups)) continue
        return { reason: 'sheet', ...at }
      }
      return null
    }
  }
}

function sameGroups(a: SheetData['groups'], b: SheetData['groups']) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((group, i) => group.range === b[i]!.range)
}
