import type { Size } from '../../utils/types'

export type TableSize = Size
export type TableAlign = 'start' | 'center' | 'end'
export type TableSortOrder = 'asc' | 'desc'
export type TableRowKey = string | number

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
}

export interface TableEmits<T = any> {
  'update:selected': [keys: TableRowKey[]]
  'update:sort': [sort: TableSort | null]
  /** A row was clicked. */
  rowClick: [row: T, index: number, event: MouseEvent]
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
  [name: `cell-${string}`]: ((props: TableCellSlotProps<T>) => unknown) | undefined
  [name: `header-${string}`]: ((props: { column: TableColumn<T> }) => unknown) | undefined
}
