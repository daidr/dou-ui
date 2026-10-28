import type { Size } from '../../utils/types'

export type TableSize = Size
export type TableAlign = 'start' | 'center' | 'end'
export type TableSortOrder = 'asc' | 'desc'
export type TableRowKey = string | number
export type TableFixed = 'start' | 'end'

export interface TableSort {
  /** The `key` of the sorted column. */
  key: string
  order: TableSortOrder
}

export interface TableColumn<T = any> {
  /** Identifies the column; also the property of a row it shows, unless `value` is given. */
  key: string
  /** The header text. */
  title?: string
  /** Reads the cell value from a row. Defaults to `row[key]`. */
  value?: (row: T) => unknown
  /** A number is in px. */
  width?: number | string
  minWidth?: number | string
  /** `end` for numbers, so the digits line up. */
  align?: TableAlign
  /**
   * Let the header sort by this column. `true` compares the cell values;
   * a function compares two rows. Ignored by `manualSort` tables except
   * to show the header as sortable.
   */
  sortable?: boolean | ((a: T, b: T) => number)
  /** Keep the cell on one line, cut off with an ellipsis. */
  ellipsis?: boolean
  /**
   * Keep the column in view while the table scrolls sideways, against the
   * start or the end edge. Give the column a number `width`.
   */
  fixed?: TableFixed
  /** Let the column be resized by dragging its header edge. Overrides the table's `resizable`. */
  resizable?: boolean
}

export interface TableProps<T = any> {
  /** The rows. */
  data: T[]
  columns: TableColumn<T>[]
  /** A property of each row, or a function, that gives the row a unique key. */
  rowKey?: string | ((row: T) => TableRowKey)
  /** Row density. */
  size?: TableSize
  /** Hairlines between columns too. */
  bordered?: boolean
  /** Tint every other row. */
  striped?: boolean
  /** Highlight the row under the pointer. */
  hoverable?: boolean
  /** Scroll the body past this height with the header pinned. A number is in px. */
  maxHeight?: number | string
  /** Dim the rows and show a spinner over them. */
  loading?: boolean
  /** Shown when there are no rows. Defaults to the locale's "no data". */
  emptyText?: string
  /**
   * Add a column of checkboxes bound to `v-model:selected`. A function
   * decides which rows can be selected.
   */
  selectable?: boolean | ((row: T) => boolean)
  /** Keys of the selected rows, bound with `v-model:selected`. */
  selected?: TableRowKey[]
  /** The sorted column and its direction, bound with `v-model:sort`. */
  sort?: TableSort | null
  /** Leave the order of `data` alone and only report `sort`, e.g. to sort on a server. */
  manualSort?: boolean
  /**
   * Add a column of toggles that open a detail row under a row, filled by
   * the `expand` slot. A function decides which rows have one.
   */
  expandable?: boolean | ((row: T) => boolean)
  /** Keys of the expanded rows (detail rows and tree rows), bound with `v-model:expanded`. */
  expanded?: TableRowKey[]
  /** The property of a row that holds its child rows, which makes the table a tree. */
  childrenKey?: string
  /** How far each tree level is indented, in px. */
  indent?: number
  /** Let every column be resized by dragging its header edge. */
  resizable?: boolean
  /** Values for a summary row under the body, by column `key`, computed from all rows. */
  summary?: (rows: T[]) => Record<string, unknown>
  /**
   * Render only the rows in view. Needs `maxHeight`; every row is
   * `rowHeight` tall and stays on one line, and detail rows are not shown.
   */
  virtual?: boolean
  /** The height of every row in a virtual table, in px. Defaults to the size's row height. */
  rowHeight?: number
}

export interface TableEmits<T = any> {
  'update:selected': [keys: TableRowKey[]]
  'update:sort': [sort: TableSort | null]
  'update:expanded': [keys: TableRowKey[]]
  /** A row was clicked. */
  rowClick: [row: T, index: number, event: MouseEvent]
  /** A column was resized, by pointer or keyboard. */
  columnResize: [key: string, width: number]
}

export interface TableCellSlotProps<T = any> {
  row: T
  column: TableColumn<T>
  value: unknown
  index: number
}

export interface TableSlots<T = any> {
  /** Every body cell. A `cell-<key>` slot takes precedence for its column. */
  cell?: (props: TableCellSlotProps<T>) => unknown
  /** A header cell. A `header-<key>` slot takes precedence for its column. */
  header?: (props: { column: TableColumn<T> }) => unknown
  /** Replaces the empty state. */
  empty?: () => unknown
  /** The detail row of an expanded row in an `expandable` table. */
  expand?: (props: { row: T; index: number }) => unknown
  [name: `cell-${string}`]: ((props: TableCellSlotProps<T>) => unknown) | undefined
  [name: `header-${string}`]: ((props: { column: TableColumn<T> }) => unknown) | undefined
}
