import { boundsOf, parseRange, type SheetBounds, type SheetPoint } from './address'
import type { SheetData } from './model'

/*
 * Merged cells. A sheet lists them as ranges (`'A1:C1'`); the cell at the
 * top left of each holds what the merged cell shows, and the cells it
 * covers are kept but not shown.
 */

/** The merged ranges of a sheet, read once, with quick lookups by cell. */
export class SheetMerges {
  static readonly EMPTY = new SheetMerges([])

  /** By row, the merges that cover it. */
  private byRow = new Map<number, SheetBounds[]>()

  constructor(readonly list: readonly SheetBounds[]) {
    for (const b of list)
      for (let row = b.top; row <= b.bottom; row++) {
        const at = this.byRow.get(row)
        if (at) at.push(b)
        else this.byRow.set(row, [b])
      }
  }

  get size() {
    return this.list.length
  }

  /** The merge covering a cell, or `undefined`. */
  at(row: number, col: number): SheetBounds | undefined {
    const list = this.byRow.get(row)
    if (!list) return undefined
    for (const b of list) if (col >= b.left && col <= b.right) return b
    return undefined
  }

  /** The merges that cover a row. */
  inRow(row: number): readonly SheetBounds[] {
    return this.byRow.get(row) ?? NONE
  }

  /** The top left cell of the merge a cell is in, or the cell itself. */
  anchor(point: SheetPoint): SheetPoint {
    const b = this.at(point.row, point.col)
    return b ? { row: b.top, col: b.left } : point
  }

  /** The cell's bounds: its merge, or just itself. */
  cell(point: SheetPoint): SheetBounds {
    return (
      this.at(point.row, point.col) ?? {
        top: point.row,
        left: point.col,
        bottom: point.row,
        right: point.col,
      }
    )
  }

  /** Grows a range until no merge sticks out of it. */
  expand(range: SheetBounds): SheetBounds {
    if (!this.list.length) return range
    const b = { ...range }
    for (let grew = true; grew;) {
      grew = false
      for (const m of this.list) {
        if (m.bottom < b.top || m.top > b.bottom || m.right < b.left || m.left > b.right) continue
        if (m.top < b.top || m.left < b.left || m.bottom > b.bottom || m.right > b.right) {
          b.top = Math.min(b.top, m.top)
          b.left = Math.min(b.left, m.left)
          b.bottom = Math.max(b.bottom, m.bottom)
          b.right = Math.max(b.right, m.right)
          grew = true
        }
      }
    }
    return b
  }

  /** The merges that touch a range. */
  touching(range: SheetBounds): SheetBounds[] {
    return this.list.filter(
      (m) =>
        m.bottom >= range.top &&
        m.top <= range.bottom &&
        m.right >= range.left &&
        m.left <= range.right,
    )
  }
}

const NONE: readonly SheetBounds[] = []
const cache = new WeakMap<readonly string[], SheetMerges>()

/** A sheet's merges, read once per list. Ranges that aren't ranges, or are one cell, are left out. */
export function mergesOf(sheet: SheetData): SheetMerges {
  const list = sheet.merges
  if (!list?.length) return SheetMerges.EMPTY
  let merges = cache.get(list)
  if (!merges) {
    const bounds: SheetBounds[] = []
    // by row, to find overlaps without comparing every pair
    const rows = new Map<number, SheetBounds[]>()
    for (const text of list) {
      const range = parseRange(text)
      if (!range) continue
      const b = boundsOf(range)
      if (!Number.isFinite(b.bottom) || !Number.isFinite(b.right)) continue
      if (b.top === b.bottom && b.left === b.right) continue
      // a merge overlapping one before it is left out
      let clash = false
      for (let row = b.top; row <= b.bottom && !clash; row++)
        clash = !!rows.get(row)?.some((m) => overlaps(m, b))
      if (clash) continue
      bounds.push(b)
      for (let row = b.top; row <= b.bottom; row++) {
        const at = rows.get(row)
        if (at) at.push(b)
        else rows.set(row, [b])
      }
    }
    merges = new SheetMerges(bounds)
    cache.set(list, merges)
  }
  return merges
}

export const overlaps = (a: SheetBounds, b: SheetBounds) =>
  a.bottom >= b.top && a.top <= b.bottom && a.right >= b.left && a.left <= b.right
