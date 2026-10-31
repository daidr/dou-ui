import type { Size } from 'dou-ui'
import type { PivotAggregator } from './engine/aggregate'
import type { PivotResult } from './engine/compute'
import type { PivotEngine } from './engine/engine'
import type { PivotData } from './engine/source'
import type { PivotAxis } from './core/layout'
import type { PivotCollapsed, PivotConfig, PivotField, PivotPath } from './engine/types'
import type { PivotMessagesOverride } from './locale'

export interface PivotProps<Row = Record<string, unknown>> {
  /**
   * The records: an array of objects, or their columns
   * (`{ region: [...], amount: [...] }`, typed arrays welcome). Replace it
   * to update it (changes inside are not seen); keep large data in a
   * `shallowRef`.
   */
  data: PivotData<Row>
  /** What the fields hold and how to show them; worked out from the records when left out. */
  fields?: readonly PivotField<Row>[]
  /** Which fields go where. */
  config?: PivotConfig
  /** The collapsed groups; all groups are open by default. */
  collapsed?: PivotCollapsed
  /**
   * The most height, a number in px or any CSS length; a shorter table ends
   * with its last row. The width fills the container.
   */
  maxHeight?: number | string
  /** Row height: 28, 32 (`md`, the default) or 40 px. */
  size?: Size
  /** The width of the row headers, in px. */
  rowHeaderWidth?: number
  /** The width of each value column, in px. */
  columnWidth?: number
  /**
   * `compact` (the default) puts the row fields in one column as a tree, a
   * group's total on its own line; `tabular` gives each row field a column
   * and an open group's total a line after its children.
   */
  layout?: 'compact' | 'tabular'
  /** Whether column widths can be dragged (and fitted with a double-click); `true` by default. */
  resizable?: boolean
  /** Ways to sum up beside the built-in ones, by the name the config uses. */
  aggregators?: readonly PivotAggregator[]
  /**
   * Sum up in a worker, keeping the page responsive. `'auto'` (the default)
   * does so above 100,000 records where workers are available.
   */
  worker?: boolean | 'auto'
  /** Where to sum up instead: your own worker (`createPivotWorker`) or a server. */
  engine?: PivotEngine
  /** The table's accessible name. */
  ariaLabel?: string
  /** Texts to override. */
  messages?: PivotMessagesOverride
}

export interface PivotFieldsProps<Row = Record<string, unknown>> {
  /** The same records as the table's; the panel reads them to list the fields and their values. */
  data: PivotData<Row>
  /** The same fields as the table's. */
  fields?: readonly PivotField<Row>[]
  /** Which fields go where; bind the same config as the table's with `v-model:config`. */
  config?: PivotConfig
  /** Ways to sum up beside the built-in ones, offered in each value's menu. */
  aggregators?: readonly PivotAggregator[]
  /**
   * Show the panel as a button that opens it in a drawer. `'auto'` (the
   * default) does so on screens narrower than the `sm` breakpoint.
   */
  drawer?: boolean | 'auto'
  /** Texts to override. */
  messages?: PivotMessagesOverride
}

/** A cell that was clicked (or activated with Enter). */
export interface PivotCellEvent<Row = Record<string, unknown>> {
  /** The row group's labels, `[]` for the grand total. */
  row: PivotPath
  /** The column group's labels, `[]` for the grand total. */
  column: PivotPath
  /** The value's place in `config.values`. */
  valueIndex: number
  /** The number in the cell; `NaN` when it is empty. */
  value: number
  /** The records summed up in the cell. */
  records: () => Row[]
  /** Their indexes in `data`. */
  indices: () => number[]
}

export interface PivotEmits<Row = Record<string, unknown>> {
  'update:config': [config: PivotConfig]
  'update:collapsed': [collapsed: PivotCollapsed]
  'cell-click': [cell: PivotCellEvent<Row>]
}

export interface PivotExpose {
  /** The groups and values on show. */
  readonly result: PivotResult
  /** Opens every group, on one axis (`rows` or `columns`) or both. */
  expandAll: (options?: { axis?: PivotAxis }) => void
  /**
   * Closes every group from `depth` in (1, the default, closes the outermost
   * groups), on one axis or both.
   */
  collapseAll: (options?: { axis?: PivotAxis; depth?: number }) => void
  /** Opens or closes a group. */
  toggle: (axis: PivotAxis, path: PivotPath, open?: boolean) => void
}
