import { formatCell } from './address'
import type { SheetWorkbook } from './model'
import { sheetKey, type SheetStep, type SheetTransaction } from './transaction'

/*
 * Comment threads on cells. A cell names the thread it is about with
 * `comment`, one thread per cell; the discussions themselves live outside
 * the workbook (`v-model:comments`). A merged cell's thread is on its top
 * left cell.
 *
 * Writing or taking off an anchor is not a change to undo: undoing some
 * typing keeps the thread on its cell. `keepCommentAnchors` puts back the
 * anchors an undo or redo would otherwise take with the cells it restores.
 */

/** Where a thread is: its sheet (by `id`, or name) and cell. */
export interface SheetCommentAnchor {
  sheet: string
  row: number
  col: number
  /** The cell as people write it, e.g. `B3`. */
  address: string
}

/** Every anchored thread in a workbook, by thread id. */
export function sheetCommentAnchors(book: SheetWorkbook): Map<string, SheetCommentAnchor> {
  const out = new Map<string, SheetCommentAnchor>()
  for (const sheet of book.sheets) {
    const key = sheetKey(sheet)
    sheet.cells.forEach((line, row) =>
      line?.forEach((cell, col) => {
        if (cell && typeof cell === 'object' && cell.comment && !out.has(cell.comment))
          out.set(cell.comment, { sheet: key, row, col, address: formatCell({ row, col }) })
      }),
    )
  }
  return out
}

/** Where a line number goes with a step; `-1` once its line is gone. */
function follow(step: SheetStep, axis: 'row' | 'col', at: number) {
  if (step.type === 'insertLines' && step.axis === axis)
    return at >= step.index ? at + step.count : at
  if (step.type === 'removeLines' && step.axis === axis) {
    if (at < step.index) return at
    return at < step.index + step.count ? -1 : at - step.count
  }
  if (step.type === 'moveLines' && step.axis === axis) {
    const { from, count, to } = step
    if (at >= from && at < from + count) return (to > from ? to - count : to) + at - from
    if (to > from && at >= from + count && at < to) return at - count
    if (to < from && at >= to && at < from) return at + count
  }
  return at
}

/**
 * Puts back the threads `tr` took off their cells by restoring what the
 * cells held before them, as undo and redo do. `before` is
 * `sheetCommentAnchors` of the workbook `tr` started from. A thread `tr`
 * itself puts on another cell (undoing a move) goes there instead, and one
 * whose row, column or sheet `tr` removed stays off. The threads are put
 * back in `into`, by default `tr` itself; give another transaction that
 * starts where `tr` ended to keep them a separate change.
 */
export function keepCommentAnchors(
  before: ReadonlyMap<string, SheetCommentAnchor>,
  tr: SheetTransaction,
  into: SheetTransaction = tr,
) {
  if (!before.size) return
  const now = sheetCommentAnchors(into.doc)
  for (const [id, anchor] of before) {
    if (now.has(id)) continue
    let { row, col } = anchor
    let gone = false
    for (const step of tr.steps) {
      if (step.type === 'removeSheet' && step.sheet === anchor.sheet) gone = true
      if (!('sheet' in step) || step.sheet !== anchor.sheet) continue
      row = follow(step, 'row', row)
      col = follow(step, 'col', col)
      if (row < 0 || col < 0) gone = true
    }
    if (gone || into.indexOf(anchor.sheet) === -1) continue
    const at = { sheet: anchor.sheet, row, col }
    const cell = into.getCell(at)
    if (cell && typeof cell === 'object' && cell.comment) continue
    into.updateCell(at, { comment: id })
  }
}
