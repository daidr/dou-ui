import type { GridItem, GridLayoutOptions, GridPosition, GridSize } from './types'

/*
 * The layout engine: plain functions from a layout to a layout.
 *
 * Every function returns a new array in the same order as the one it was
 * given, and keeps the objects of the items that did not move, so a caller
 * can tell what changed by identity. The same input always gives the same
 * output: the order items are settled in depends only on their positions
 * and their places in the array, which is what lets several people editing
 * the same layout end up with the same result.
 */

type Box = Pick<GridItem, 'x' | 'y' | 'w' | 'h'>

/** Whether two boxes share at least one cell. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** The row just below the lowest item: how many rows the layout takes up. */
export function layoutHeight(items: readonly Box[]): number {
  let bottom = 0
  for (const item of items) bottom = Math.max(bottom, item.y + item.h)
  return bottom
}

const int = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.round(value) : fallback

/** The width an item may have on a grid of `columns`. */
function clampW(item: GridItem, w: number, columns: number) {
  const max = Math.min(columns, item.maxW ?? columns)
  const min = Math.min(max, Math.max(1, item.minW ?? 1))
  return Math.min(max, Math.max(min, int(w, min)))
}

function clampH(item: GridItem, h: number) {
  const max = Math.max(1, item.maxH ?? Infinity)
  const min = Math.min(max, Math.max(1, item.minH ?? 1))
  return Math.min(max, Math.max(min, int(h, min)))
}

/**
 * The item with its size inside its limits and the grid's width, and its
 * position on the grid, in whole cells. Returns the item itself when it fits.
 */
export function fitItem(item: GridItem, columns: number): GridItem {
  const w = clampW(item, item.w, columns)
  const h = clampH(item, item.h)
  const x = Math.min(columns - w, Math.max(0, int(item.x, 0)))
  const y = Math.max(0, int(item.y, 0))
  return x === item.x && y === item.y && w === item.w && h === item.h
    ? item
    : { ...item, x, y, w, h }
}

const at = (item: GridItem, x: number, y: number): GridItem =>
  item.x === x && item.y === y ? item : { ...item, x, y }

/**
 * Where an item the moved one landed on could step aside to: the same
 * row, shifted into the columns the moved item left. This is what turns
 * dropping an item onto its neighbour into a swap, instead of pushing the
 * neighbour down. `undefined` when the item isn't in the way, or wouldn't
 * fit in those columns.
 */
function aside(item: GridItem, fixed?: GridItem, origin?: Box): number | undefined {
  if (!fixed || !origin || !overlaps(item, fixed)) return undefined
  const hi = origin.x + origin.w - item.w
  if (hi < origin.x) return undefined
  const x = Math.min(hi, Math.max(origin.x, item.x))
  return x === item.x ? undefined : x
}

/** The first of `boxes` that shares a cell with the box, if any. */
function hit(boxes: readonly Box[], box: Box): Box | undefined {
  for (const other of boxes) if (overlaps(other, box)) return other
  return undefined
}

/** Moves the box down until it is clear of every one of `boxes`; returns its row. */
function below(boxes: readonly Box[], box: Box): number {
  const probe = { ...box }
  for (let other = hit(boxes, probe); other; other = hit(boxes, probe)) probe.y = other.y + other.h
  return probe.y
}

/**
 * Settles every item that isn't locked and isn't `fixed`; those stay where
 * they are and the rest go around them. Items are settled from the top
 * down (then left to right, then by their place in the array).
 */
function settle(
  items: readonly GridItem[],
  options: GridLayoutOptions,
  fixed?: GridItem,
  origin?: Box,
): GridItem[] {
  const out = items.slice()
  const obstacles: GridItem[] = []
  const order: number[] = []
  items.forEach((item, i) => {
    if (item.locked || item === fixed) obstacles.push(item)
    else order.push(i)
  })
  order.sort((a, b) => items[a]!.y - items[b]!.y || items[a]!.x - items[b]!.x || a - b)

  if (options.compact === false) {
    // Each item keeps its row unless something settled before it is in the way.
    const placed = obstacles.slice()
    for (const i of order) {
      const item = items[i]!
      let x = item.x
      let y = below(placed, item)
      const side = aside(item, fixed, origin)
      if (side !== undefined && !hit(placed, { ...item, x: side })) [x, y] = [side, item.y]
      placed.push((out[i] = at(item, x, y)))
    }
    return out
  }

  // `top[c]` is the row below everything settled so far in column `c`: an
  // item can float up to the lowest of these across its columns, which is
  // as far as it can go without passing an item that was above it.
  const top = new Int32Array(options.columns)
  for (const i of order) {
    const item = items[i]!
    const rise = (x: number) => {
      let y = 0
      for (let c = x; c < x + item.w; c++) y = Math.max(y, top[c] ?? 0)
      return below(obstacles, { x, y, w: item.w, h: item.h })
    }
    let x = item.x
    let y = rise(x)
    const side = aside(item, fixed, origin)
    if (side !== undefined) {
      const y2 = rise(side)
      if (y2 < y) [x, y] = [side, y2]
    }
    for (let c = x; c < x + item.w; c++) top[c] = y + item.h
    out[i] = at(item, x, y)
  }
  return out
}

/**
 * The layout fitted to the grid: sizes inside their limits, nothing past
 * the last column, no two items on the same cell and, when compacting,
 * no gaps above items. Returns `items` itself when it is already settled.
 */
export function normalizeLayout(
  items: readonly GridItem[],
  options: GridLayoutOptions,
): readonly GridItem[] {
  const fitted = items.map((item) => fitItem(item, options.columns))
  const out = settle(fitted, options)
  return out.every((item, i) => item === items[i]) ? items : out
}

/** Floats every item up as far as it goes (ignores `compact`). */
export function compactLayout(items: readonly GridItem[], columns: number): GridItem[] {
  return settle(items, { columns, compact: 'vertical' })
}

/** Puts `item` at the given place, moved down below any locked item it lands on. */
function place(
  items: readonly GridItem[],
  index: number,
  next: GridItem,
  options: GridLayoutOptions,
): GridItem[] {
  const locked = items.filter((other) => other.locked && other !== items[index])
  const y = below(locked, next)
  const out = items.slice()
  const moved = (out[index] = at(next, next.x, y))
  const settled = settle(out, options, moved, items[index])
  // Compacting a second time lets the item itself float up into the gap
  // it would otherwise leave, and puts it after the items it was dropped below.
  return options.compact === false ? settled : settle(settled, options)
}

/**
 * Moves an item to a cell; the items it lands on make way. Locked items
 * and unknown ids leave the layout as it is.
 */
export function moveItem(
  items: readonly GridItem[],
  id: string,
  to: GridPosition,
  options: GridLayoutOptions,
): readonly GridItem[] {
  const index = items.findIndex((item) => item.id === id)
  const item = items[index]
  if (!item || item.locked) return items
  const x = Math.min(options.columns - item.w, Math.max(0, int(to.x, item.x)))
  const y = Math.max(0, int(to.y, item.y))
  return place(items, index, { ...item, x, y }, options)
}

/**
 * Gives an item a new size, keeping its top-left corner; the items it now
 * covers make way. A size that would cover a locked item is refused.
 */
export function resizeItem(
  items: readonly GridItem[],
  id: string,
  to: GridSize,
  options: GridLayoutOptions,
): readonly GridItem[] {
  const index = items.findIndex((item) => item.id === id)
  const item = items[index]
  if (!item || item.locked) return items
  const w = Math.min(options.columns - item.x, clampW(item, to.w, options.columns))
  const h = clampH(item, to.h)
  const next = { ...item, w: Math.max(1, w), h }
  if (items.some((other) => other.locked && other !== item && overlaps(other, next))) return items
  return place(items, index, next, options)
}

const sameSpot = (a: GridItem | undefined, b: GridItem) =>
  !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

/**
 * Moves an item by whole cells, as the arrow keys do. Moving up or down
 * goes on past rows where the item would only settle back where it was,
 * so one press always moves it, to the next place it can take.
 */
export function moveItemBy(
  items: readonly GridItem[],
  id: string,
  dx: number,
  dy: number,
  options: GridLayoutOptions,
): readonly GridItem[] {
  const item = items.find((other) => other.id === id)
  if (!item || item.locked) return items
  if (!dy) return moveItem(items, id, { x: item.x + dx, y: item.y }, options)
  const step = Math.sign(dy)
  const last = layoutHeight(items)
  for (let y = item.y + dy; y >= 0 && y <= last; y += step) {
    const out = moveItem(items, id, { x: item.x + dx, y }, options)
    if (
      !sameSpot(
        out.find((other) => other.id === id),
        item,
      )
    )
      return out
  }
  return items
}

/** Resizes an item by whole cells, as Shift and the arrow keys do. */
export function resizeItemBy(
  items: readonly GridItem[],
  id: string,
  dw: number,
  dh: number,
  options: GridLayoutOptions,
): readonly GridItem[] {
  const item = items.find((other) => other.id === id)
  if (!item) return items
  return resizeItem(items, id, { w: item.w + dw, h: item.h + dh }, options)
}

/**
 * Where a new item of `size` fits: the first free spot reading from the top
 * left, or below everything when no row has room.
 */
export function findPlace(
  items: readonly GridItem[],
  size: GridSize,
  options: GridLayoutOptions,
): GridPosition {
  const w = Math.min(options.columns, Math.max(1, Math.round(size.w)))
  const h = Math.max(1, Math.round(size.h))
  const bottom = layoutHeight(items)
  for (let y = 0; y < bottom; y++)
    for (let x = 0; x + w <= options.columns; x++) {
      const other = hit(items, { x, y, w, h })
      if (!other) return { x, y }
      // skip to the column after the item in the way
      x = other.x + other.w - 1
    }
  return { x: 0, y: bottom }
}

/** Where items land when their edges, counted from `origin`, are scaled by `factor`. */
function scaleEdges(items: readonly GridItem[], origin: number, factor: number) {
  // both edges are rounded, so items side by side stay side by side
  const edge = (value: number) => Math.round((value - origin) * factor)
  return items.map((item) => {
    const x = edge(item.x)
    return { x, w: Math.max(1, edge(item.x + item.w) - x) }
  })
}

/** Whether items that were equally wide still are. */
function keepsEqual(items: readonly GridItem[], spans: readonly { w: number }[]) {
  const widths = new Map<number, number>()
  return items.every((item, i) => {
    const w = widths.get(item.w)
    if (w === undefined) widths.set(item.w, spans[i]!.w)
    return w === undefined || w === spans[i]!.w
  })
}

interface Span {
  item: GridItem
  x: number
  /** Line within the row, 0 when the row didn't wrap. */
  line: number
  w: number
}

/**
 * One row (items sharing a `y`, left to right) on `to` columns. Scaled
 * as is when equally wide items stay equally wide; otherwise the row is
 * wrapped onto as few lines as it takes for them to, each line holding
 * `from / lines` source columns, so four quarters of 12 columns become
 * two lines of halves on 6.
 */
function scaleRow(row: readonly GridItem[], from: number, to: number): Span[] {
  const spans = scaleEdges(row, 0, to / from)
  if (keepsEqual(row, spans)) return row.map((item, i) => ({ item, line: 0, ...spans[i]! }))
  for (let lines = 2; ; lines++) {
    const capacity = from / lines
    const groups: GridItem[][] = []
    for (const item of row) {
      const group = groups[groups.length - 1]
      if (group && item.x + item.w - group[0]!.x <= capacity) group.push(item)
      else groups.push([item])
    }
    if (groups.length > lines && lines < row.length) continue
    const out: Span[] = []
    for (const [line, group] of groups.entries()) {
      const scaled = scaleEdges(group, group[0]!.x, (to * lines) / from)
      for (const [i, item] of group.entries())
        out.push({ item, line, x: scaled[i]!.x, w: Math.min(to, scaled[i]!.w) })
    }
    if (
      lines >= row.length ||
      (out.every((span) => span.x + span.w <= to) &&
        keepsEqual(
          out.map((span) => span.item),
          out,
        ))
    )
      return out
  }
}

/**
 * The layout worked out for a grid of another width: positions and widths
 * scaled by the ratio of the columns, then settled. Items in a row that
 * were equally wide stay equally wide; when the columns don't divide
 * evenly, the row wraps instead (four quarters of 12 columns become two
 * lines of halves on 6). On a single column the items are stacked in
 * reading order (top to bottom, then left to right), each keeping its height.
 */
export function deriveLayout(
  items: readonly GridItem[],
  from: number,
  options: GridLayoutOptions,
): readonly GridItem[] {
  const to = options.columns
  if (from === to) return normalizeLayout(items, options)
  if (to === 1) {
    const order = items.map((_, i) => i)
    order.sort((a, b) => items[a]!.y - items[b]!.y || items[a]!.x - items[b]!.x || a - b)
    const out = items.slice()
    let y = 0
    for (const i of order) {
      const item = fitItem({ ...items[i]!, x: 0, w: 1 }, 1)
      out[i] = { ...item, y }
      y += item.h
    }
    return out
  }
  const scale = to / from
  const limit = (value: number | undefined) =>
    value === undefined ? undefined : Math.max(1, Math.round(value * scale))
  const rows = new Map<number, GridItem[]>()
  for (const item of items) {
    const row = rows.get(item.y)
    if (row) row.push(item)
    else rows.set(item.y, [item])
  }
  const placed = new Map<GridItem, GridItem>()
  // rows that wrap push everything below them down by the lines they add
  let shift = 0
  const ys = [...rows.keys()]
  ys.sort((a, b) => a - b)
  for (const y of ys) {
    const row = rows.get(y)!
    row.sort((a, b) => a.x - b.x)
    const lineTop = [0]
    const spans = scaleRow(row, from, to)
    for (const span of spans) {
      const top = lineTop[span.line] ?? 0
      lineTop[span.line + 1] = Math.max(lineTop[span.line + 1] ?? 0, top + span.item.h)
    }
    for (const span of spans) {
      const top = lineTop[span.line]!
      placed.set(
        span.item,
        fitItem(
          {
            ...span.item,
            x: span.x,
            y: y + shift + top,
            w: span.w,
            minW: limit(span.item.minW),
            maxW: limit(span.item.maxW),
          },
          to,
        ),
      )
    }
    const height = Math.max(...row.map((item) => item.h))
    shift += lineTop[lineTop.length - 1]! - height
  }
  return normalizeLayout(
    items.map((item) => placed.get(item)!),
    options,
  )
}
