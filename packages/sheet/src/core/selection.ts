import { boundsOf, inBounds, pointRange, type SheetPoint, type SheetRange } from './address'

/**
 * What is selected on a sheet: one or more ranges, and the cell the
 * keyboard is on, which is inside the last range.
 */
export interface SheetSelection {
  active: SheetPoint
  ranges: SheetRange[]
}

/** One cell selected. */
export const selectCell = (point: SheetPoint): SheetSelection => ({
  active: point,
  ranges: [pointRange(point)],
})

/** Whether a cell is in any of the selected ranges. */
export function isSelected(selection: SheetSelection, row: number, col: number) {
  return selection.ranges.some((range) => inBounds(boundsOf(range), row, col))
}

/** Keeps a point inside a sheet of `rows` × `cols`. */
export const clampPoint = (point: SheetPoint, rows: number, cols: number): SheetPoint => ({
  row: Math.max(0, Math.min(rows - 1, point.row)),
  col: Math.max(0, Math.min(cols - 1, point.col)),
})

/** The selection kept inside a sheet of `rows` × `cols`, e.g. after it shrank. */
export function clampSelection(selection: SheetSelection, rows: number, cols: number) {
  const clamp = (point: SheetPoint) => clampPoint(point, rows, cols)
  return {
    active: clamp(selection.active),
    ranges: selection.ranges.map((range) => ({ start: clamp(range.start), end: clamp(range.end) })),
  }
}

export const samePoint = (a: SheetPoint, b: SheetPoint) => a.row === b.row && a.col === b.col

export function sameSelection(a: SheetSelection, b: SheetSelection) {
  return (
    samePoint(a.active, b.active) &&
    a.ranges.length === b.ranges.length &&
    a.ranges.every((range, i) => {
      const other = b.ranges[i]!
      return samePoint(range.start, other.start) && samePoint(range.end, other.end)
    })
  )
}
