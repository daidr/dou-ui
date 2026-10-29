import type { GridGap, Responsive } from '../grid/grid'

export type MasonryKey = string | number

export interface MasonryProps<T = any> {
  /** The items, in reading order. */
  items: T[]
  /** The number of columns. May change with the viewport width, like Grid's `cols`. */
  columns?: Responsive<number>
  /** Gap between items: a step of the spacing scale or a CSS length; a pair sets rows and columns apart. */
  gap?: GridGap | [row: GridGap, column: GridGap]
  /** A property of each item, or a function, that gives it a unique key. Defaults to the index. */
  itemKey?: string | ((item: T, index: number) => MasonryKey)
}

export interface MasonrySlots<T = any> {
  /** One item. */
  default?: (props: { item: T; index: number }) => unknown
}

export interface MasonryExpose {
  /** Measure every item and place them again, e.g. after a change the component cannot see. */
  relayout: () => void
}

export interface MasonryPlacement {
  column: number
  top: number
}

/**
 * Place items of the given heights, in order, each at the top of the
 * shortest column; ties go to the column nearest the start. Returns each
 * item's place and the height of the tallest column.
 */
export function placeItems(heights: number[], columns: number, rowGap: number) {
  const bottoms = Array.from({ length: columns }, () => 0)
  const placements = heights.map((height): MasonryPlacement => {
    let column = 0
    for (let index = 1; index < columns; index++) {
      if (bottoms[index]! < bottoms[column]!) column = index
    }
    const top = bottoms[column]!
    bottoms[column] = top + height + rowGap
    return { column, top }
  })
  const tallest = Math.max(0, ...bottoms)
  return { placements, height: heights.length ? tallest - rowGap : 0 }
}
