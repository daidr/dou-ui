import type { Size } from '../../utils/types'

/** The viewport widths the responsive values switch at: 640, 768, 1024 and 1280px. */
export type GridBreakpoint = 'sm' | 'md' | 'lg' | 'xl'

/**
 * A value that may change with the viewport width. Each breakpoint applies
 * from its width up, until a larger breakpoint takes over; `base` applies
 * below every breakpoint.
 */
export type Responsive<T> = T | ({ base?: T } & Partial<Record<GridBreakpoint, T>>)

export type GridGap = Size | number | string

export interface GridProps {
  /** The number of equal columns. */
  cols?: Responsive<number>
  /**
   * Fit as many columns as there is room for, each at least this wide
   * (numbers are pixels). Takes the place of `cols`.
   */
  minItemWidth?: number | string
  /** Gap between cells: a step of the spacing scale or a CSS length; a pair sets rows and columns apart. */
  gap?: GridGap | [row: GridGap, column: GridGap]
  /** Vertical alignment of the cells in a row. */
  align?: 'start' | 'center' | 'end' | 'stretch'
}

export interface GridSlots {
  /** The cells: `DouGridItem`s, or any elements that take one column each. */
  default?: () => unknown
}

export type GridSpan = number | 'full'

export interface GridItemProps {
  /** How many columns the cell covers, or `full` for the whole row. */
  span?: Responsive<GridSpan>
  /** The column the cell starts at, from 1. */
  start?: Responsive<number>
  /** How many rows the cell covers. */
  rowSpan?: number
}

export interface GridItemSlots {
  default?: () => unknown
}
