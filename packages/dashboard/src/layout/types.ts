/** One item on the grid, placed in whole columns and rows. */
export interface GridItem {
  id: string
  /** The column of its left edge, from 0. */
  x: number
  /** The row of its top edge, from 0. */
  y: number
  /** Its width in columns. */
  w: number
  /** Its height in rows. */
  h: number
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
  /** Can't be moved or resized, and stays where it is: the other items go around it. */
  locked?: boolean
}

/**
 * How items settle after a change:
 *
 * - `'vertical'`: every item floats up as far as it can, so there are no gaps above it;
 * - `false`: items stay where they are put, and only move down out of each other's way.
 */
export type GridCompact = 'vertical' | false

export interface GridLayoutOptions {
  /** How many columns the grid has. */
  columns: number
  /** Defaults to `'vertical'`. */
  compact?: GridCompact
}

export interface GridPosition {
  x: number
  y: number
}

export interface GridSize {
  w: number
  h: number
}
