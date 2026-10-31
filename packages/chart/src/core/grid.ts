/*
 * A grid over scattered points, for finding the ones near the pointer
 * without going through all of them: each cell lists the points in it.
 * Made once per data, in the data's own numbers, so it holds while zooming.
 */

export interface PointGrid {
  /** The data's x and y stretch the cells cover. */
  x0: number
  y0: number
  /** Cells across and down, and the size of one in data numbers. */
  columns: number
  rows: number
  width: number
  height: number
  /** Where each cell's points start in `items`; the cell after ends them. */
  starts: Int32Array
  /** The points, cell by cell. */
  items: Int32Array
}

/** About this many points to a cell. */
const PER_CELL = 4
/** At most this many cells along each side. */
const MOST = 1024

const grids = new WeakMap<Float64Array, { xs: Float64Array; grid: PointGrid }>()

/** The grid of the points `(xs[i], ys[i])`; points with a `NaN` are left out. Cached per data. */
export function pointGrid(xs: Float64Array, ys: Float64Array): PointGrid {
  const known = grids.get(ys)
  if (known && known.xs === xs) return known.grid
  const n = Math.min(xs.length, ys.length)
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  let count = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i]!
    const y = ys[i]!
    if (x !== x || y !== y) continue
    count++
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  const side = Math.min(MOST, Math.max(1, Math.ceil(Math.sqrt(count / PER_CELL))))
  const columns = x1 > x0 ? side : 1
  const rows = y1 > y0 ? side : 1
  const width = (x1 - x0) / columns || 1
  const height = (y1 - y0) / rows || 1
  // each point's cell, then the points sorted by cell (a counting sort)
  const cells = new Int32Array(n)
  const starts = new Int32Array(columns * rows + 1)
  for (let i = 0; i < n; i++) {
    const x = xs[i]!
    const y = ys[i]!
    if (x !== x || y !== y) {
      cells[i] = -1
      continue
    }
    const c = Math.min(columns - 1, Math.floor((x - x0) / width))
    const r = Math.min(rows - 1, Math.floor((y - y0) / height))
    const at = r * columns + c
    cells[i] = at
    starts[at + 1]!++
  }
  for (let k = 1; k < starts.length; k++) starts[k]! += starts[k - 1]!
  const items = new Int32Array(count)
  const fill = starts.slice(0, -1)
  for (let i = 0; i < n; i++) {
    const at = cells[i]!
    if (at >= 0) items[fill[at]!++] = i
  }
  const grid: PointGrid = { x0, y0, columns, rows, width, height, starts, items }
  grids.set(ys, { xs, grid })
  return grid
}

/** The cell along one side that `value` is in, kept on the grid. */
const cell = (value: number, origin: number, size: number, most: number) =>
  Math.min(most - 1, Math.max(0, Math.floor((value - origin) / size)))

/** Calls `visit` with each point in the cells that touch the data box from `(xa, ya)` to `(xb, yb)`. */
export function eachNear(
  grid: PointGrid,
  xa: number,
  xb: number,
  ya: number,
  yb: number,
  visit: (index: number) => void,
) {
  const { x0, y0, columns, rows, width, height, starts, items } = grid
  const c0 = cell(Math.min(xa, xb), x0, width, columns)
  const c1 = cell(Math.max(xa, xb), x0, width, columns)
  const r0 = cell(Math.min(ya, yb), y0, height, rows)
  const r1 = cell(Math.max(ya, yb), y0, height, rows)
  // a box wholly off the grid's side touches nothing
  if (Math.max(xa, xb) < x0 || Math.min(xa, xb) > x0 + width * columns) return
  if (Math.max(ya, yb) < y0 || Math.min(ya, yb) > y0 + height * rows) return
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const at = r * columns + c
      for (let k = starts[at]!, end = starts[at + 1]!; k < end; k++) visit(items[k]!)
    }
  }
}
