import type { Size } from 'dou-ui'
import type { PivotAggregator } from './engine/aggregate'
import type { PivotResult } from './engine/compute'
import type { PivotAxis } from './core/layout'
import type { PivotCollapsed, PivotConfig, PivotField, PivotPath } from './engine/types'
import type { PivotMessagesOverride } from './locale'

export interface PivotProps<Row = Record<string, unknown>> {
  /**
   * The records. Replace the array to update it (changes inside it are not
   * seen); for large data keep it in a `shallowRef`.
   */
  data: readonly Row[]
  /** What the fields hold and how to show them; worked out from the records when left out. */
  fields?: readonly PivotField<Row>[]
  /** Which fields go where. */
  config?: PivotConfig
  /** The collapsed groups; all groups are open by default. */
  collapsed?: PivotCollapsed
  /** Height, a number in px or any CSS length. The width fills the container. */
  height?: number | string
  /** Row height: 28, 32 (`md`, the default) or 40 px. */
  size?: Size
  /** The width of the row headers, in px. */
  rowHeaderWidth?: number
  /** The width of each value column, in px. */
  columnWidth?: number
  /** Ways to sum up beside the built-in ones, by the name the config uses. */
  aggregators?: readonly PivotAggregator[]
  /** The table's accessible name. */
  ariaLabel?: string
  /** Texts to override. */
  messages?: PivotMessagesOverride
}

/** A cell that was clicked (or activated with Enter). */
export interface PivotCellEvent {
  /** The row group's labels, `[]` for the grand total. */
  row: PivotPath
  /** The column group's labels, `[]` for the grand total. */
  column: PivotPath
  /** The value's place in `config.values`. */
  value: number
  /** The number in the cell; `NaN` when it is empty. */
  number: number
  /** The indexes of the records summed up in the cell. */
  records: () => number[]
}

export interface PivotEmits {
  'update:config': [config: PivotConfig]
  'update:collapsed': [collapsed: PivotCollapsed]
  'cell-click': [cell: PivotCellEvent]
}

export interface PivotExpose {
  /** The groups and values on show. */
  readonly result: PivotResult
  /** Opens every group, on one axis or both. */
  expandAll: (axis?: PivotAxis) => void
  /** Closes every group from `depth` in (1, the default, closes the outermost groups). */
  collapseAll: (axis?: PivotAxis, depth?: number) => void
  /** Opens or closes a group. */
  toggle: (axis: PivotAxis, path: PivotPath, open?: boolean) => void
}
