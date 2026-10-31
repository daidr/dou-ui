/** The `props` of a `chart` widget. */
export interface ChartWidgetProps {
  source?: string
  /** Where the rows are, when the data isn't the list itself. */
  path?: string
  /** `line` by default. */
  kind?: 'line' | 'area' | 'bar' | 'pie'
  /** The row's key along x: categories or dates; a pie's slice names. */
  x?: string
  /** The keys drawn, one series each; a pie draws the first. */
  y?: string[]
  /** Names of the keys in the legend and the tooltip. */
  labels?: Record<string, string>
  /** Stacks the series (areas and bars). */
  stacked?: boolean
  /** Lays bars across. */
  horizontal?: boolean
  /**
   * Clicking an x (or a slice) sets the filter of this name to it for the
   * other widgets; clicking it again clears it.
   */
  filterKey?: string
}
