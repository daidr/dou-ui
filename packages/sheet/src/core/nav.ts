import type { SheetPoint } from './address'
import type { SheetAxis } from './axis'

/** One step from `index` along an axis, skipping hidden rows or columns; stays put at the edge. */
export function stepIndex(axis: SheetAxis, index: number, step: 1 | -1) {
  for (let i = index + step; i >= 0 && i < axis.count; i += step) if (!axis.hidden(i)) return i
  return index
}

/**
 * Where `mod` + an arrow goes: to the edge of the block of filled cells the
 * cell is in, or on to the next filled cell, or to the sheet's edge.
 */
export function edgeIndex(
  axis: SheetAxis,
  index: number,
  step: 1 | -1,
  filled: (index: number) => boolean,
) {
  const next = stepIndex(axis, index, step)
  if (next === index) return index
  let at = next
  if (filled(index) && filled(next)) {
    // to the last filled cell of this block
    for (let i = next; ;) {
      const after = stepIndex(axis, i, step)
      if (after === i || !filled(after)) return i
      i = after
    }
  }
  // on to the next filled cell, or the edge
  while (!filled(at)) {
    const after = stepIndex(axis, at, step)
    if (after === at) return at
    at = after
  }
  return at
}

export type SheetDirection = 'up' | 'down' | 'left' | 'right'

/** A point moved one cell, or to the data edge with `jump`. */
export function movePoint(
  point: SheetPoint,
  direction: SheetDirection,
  axes: { rows: SheetAxis; cols: SheetAxis },
  filled: (row: number, col: number) => boolean,
  jump = false,
): SheetPoint {
  const vertical = direction === 'up' || direction === 'down'
  const step = direction === 'up' || direction === 'left' ? -1 : 1
  const axis = vertical ? axes.rows : axes.cols
  const index = vertical ? point.row : point.col
  const to = jump
    ? edgeIndex(axis, index, step, (i) => (vertical ? filled(i, point.col) : filled(point.row, i)))
    : stepIndex(axis, index, step)
  return vertical ? { row: to, col: point.col } : { row: point.row, col: to }
}
