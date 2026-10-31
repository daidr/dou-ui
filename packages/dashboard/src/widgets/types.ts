/** The `props` of a `stat` widget. */
export interface StatWidgetProps {
  /** The source to read from; without it the widget shows `value`. */
  source?: string
  /** Where the number is in the source's data, as a dotted path (`total.amount`). */
  field?: string
  /** The number shown when there is no source. */
  value?: number
  prefix?: string
  unit?: string
  /** Decimal places. */
  precision?: number
  /** Where a list of numbers is, drawn as a sparkline under the number. */
  trend?: string
  /** Where the change since the last period is, as a ratio (`0.125` reads `+12.5%`). */
  delta?: string
}

/** The `props` of a `text` widget. */
export interface TextWidgetProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

export interface TableWidgetColumn {
  /** The row's key it shows. */
  key: string
  /** The header; defaults to the key. */
  title?: string
}

/** The `props` of a `table` widget. */
export interface TableWidgetProps {
  source?: string
  /** Where the rows are, when the data isn't the list itself. */
  path?: string
  /** The columns, in order; defaults to every key of the first row. */
  columns?: TableWidgetColumn[]
  /** The field that tells rows apart; defaults to their place in the list. */
  rowKey?: string
}
