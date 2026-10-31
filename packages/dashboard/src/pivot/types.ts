import type { PivotConfig } from '@dou-ui/pivot'

/** The `props` of a `pivot` widget. */
export interface PivotWidgetProps {
  source?: string
  /** Where the records are, when the data isn't the list itself. */
  path?: string
  /** Which fields go where, as `DouPivot`'s `config`. */
  config?: PivotConfig
  /** Clicking a cell filters the other widgets by its row and column groups, one filter per field. */
  filter?: boolean
}
