import {
  cellOf,
  type SheetCell,
  type SheetCellInput,
  type SheetData,
  type SheetProtection,
  type SheetWorkbook,
} from './model'
import { SheetTransaction, sheetKey, type SheetStep } from './transaction'

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

/** Whether a cell is locked: unless its style says `locked: false`. Takes a cell as `cells` hold it. */
export function isLocked(cell: SheetCellInput, book: SheetWorkbook) {
  const name = cellOf(cell)?.style
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
  const { steps } = tr
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!
    const refusal = checkStep(step, replay.doc)
    if (refusal) return refusal
    // when lines move or a sheet is renamed, formulas and rules follow them:
    // the steps that do exactly that go ahead, anything more is checked
    const follow = following(step, replay.doc)
    replay.step(step)
    if (follow && sameSteps(steps, i + 1, follow)) {
      for (const next of follow) replay.step(next)
      i += follow.length
    }
  }
  return null
}

/**
 * The steps that follow `step` when the transaction makes it: formulas,
 * rules, merges and groups moved along with lines, or naming a sheet anew.
 */
function following(step: SheetStep, book: SheetWorkbook): SheetStep[] | null {
  const own = new SheetTransaction(book)
  // the transaction's own ways of making these steps, with what follows them
  const make = own as unknown as {
    insertLines: (axis: string, index: number, count: number, sheet: string) => void
    deleteLines: (axis: string, index: number, count: number, sheet: string) => void
    moveLines: (axis: string, from: number, count: number, to: number, sheet: string) => void
  }
  try {
    switch (step.type) {
      case 'insertLines':
        if (step.cells || step.sizes) return null
        make.insertLines(step.axis, step.index, step.count, step.sheet)
        break
      case 'removeLines':
        make.deleteLines(step.axis, step.index, step.count, step.sheet)
        break
      case 'moveLines':
        make.moveLines(step.axis, step.from, step.count, step.to, step.sheet)
        break
      case 'removeSheet':
        own.removeSheet(step.sheet)
        break
      case 'updateSheet': {
        const keys = Object.keys(step.patch)
        if (keys.length !== 1 || keys[0] !== 'name' || !step.patch.name) return null
        own.renameSheet(step.sheet, step.patch.name)
        break
      }
      default:
        return null
    }
  } catch {
    return null
  }
  return own.steps.slice(1)
}

function sameSteps(steps: readonly SheetStep[], from: number, expected: SheetStep[]) {
  if (!expected.length) return false
  if (from + expected.length > steps.length) return false
  return expected.every((step, i) => JSON.stringify(step) === JSON.stringify(steps[from + i]))
}

function sheetOf(book: SheetWorkbook, key: string) {
  return book.sheets.find((sheet) => (sheet.id ?? sheet.name) === key)
}

function checkStep(step: SheetStep, book: SheetWorkbook): SheetProtectionCheck | null {
  switch (step.type) {
    case 'updateBook':
      return null
    case 'setType':
      // a named type changed in place changes every cell using it
      if (!book.types?.[step.name]) return null
      return lockedUsing(book, (cell) => cell.type === step.name)
    case 'setStyle': {
      // a style changed in place locks or unlocks, and restyles, every cell using it
      const old = book.styles?.[step.name]
      if (!old) return null
      if ((old.locked !== false) !== (step.style?.locked !== false))
        return book.sheets.some((sheet) => sheet.protect) ? { reason: 'lock' } : null
      return lockedUsing(book, (cell) => cell.style === step.name)
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
      if (!locked) return null
      if (!sameContent(old, next)) return { reason: 'cell', ...where }
      return protect.formatCells ? null : { reason: 'format', ...where }
    }
    case 'setSize':
      if (step.axis === 'row') return protect.formatRows ? null : { reason: 'formatRows', ...at }
      return protect.formatColumns ? null : { reason: 'formatColumns', ...at }
    case 'insertLines':
      if (step.axis === 'row') return protect.insertRows ? null : { reason: 'insertRows', ...at }
      return protect.insertColumns ? null : { reason: 'insertColumns', ...at }
    case 'removeLines': {
      const row = step.axis === 'row'
      if (!(row ? protect.deleteRows : protect.deleteColumns))
        return { reason: row ? 'deleteRows' : 'deleteColumns', ...at }
      // lines may go only without the locked cells in them
      return lockedIn(sheet, book, (r, c) => {
        const n = row ? r : c
        return n >= step.index && n < step.index + step.count
      })
    }
    case 'moveLines':
      return { reason: 'sheet', ...at }
    case 'updateSheet': {
      for (const key of Object.keys(step.patch) as (keyof typeof step.patch)[]) {
        // a rename is the workbook's to allow
        if (FREE_FIELDS.has(key) || key === 'name' || sheet[key] === step.patch[key]) continue
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

/** The first locked cell holding something on `sheet` where `where` says, as a refusal. */
function lockedIn(
  sheet: SheetData,
  book: SheetWorkbook,
  where: (row: number, col: number) => boolean,
): SheetProtectionCheck | null {
  for (const [row, line] of sheet.cells.entries()) {
    if (!line) continue
    for (const [col, input] of line.entries()) {
      const cell = cellOf(input)
      if (cell == null || !where(row, col) || !isLocked(cell, book)) continue
      return { reason: 'cell', sheet: sheetKey(sheet), row, col }
    }
  }
  return null
}

/**
 * The first locked cell that `uses` a style or type on a sheet that keeps
 * its locked cells' look, as a refusal.
 */
function lockedUsing(
  book: SheetWorkbook,
  uses: (cell: SheetCell) => boolean,
): SheetProtectionCheck | null {
  for (const sheet of book.sheets) {
    const protect = protectionOf(sheet)
    if (!protect || protect.formatCells) continue
    for (const [row, line] of sheet.cells.entries())
      for (const [col, input] of (line ?? []).entries()) {
        const cell = cellOf(input)
        if (cell && uses(cell) && isLocked(cell, book))
          return { reason: 'format', sheet: sheetKey(sheet), row, col }
      }
  }
  return null
}

function sameGroups(a: SheetData['groups'], b: SheetData['groups']) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((group, i) => group.range === b[i]!.range)
}
