/** What a field holds; it decides how values are grouped, sorted and shown. */
export type PivotFieldType = 'string' | 'number' | 'date' | 'boolean'

/**
 * How a value or a group label is written: options for `Intl.NumberFormat`
 * (numbers) or `Intl.DateTimeFormat` (dates), or a function.
 */
export type PivotFormat =
  | Intl.NumberFormatOptions
  | Intl.DateTimeFormatOptions
  // oxlint-disable-next-line typescript/no-explicit-any
  | ((value: any) => string)

/** A field of the records: something to group by, or to sum up. */
export interface PivotField<Row = Record<string, unknown>> {
  /** The key on each record, and how the config refers to the field. */
  name: string
  /** The name in headers and the field list; `name` when left out. */
  label?: string
  /** Guessed from the first records when left out. */
  type?: PivotFieldType
  /** Reads the field from a record, for fields that are worked out per record. */
  value?: (row: Row, index: number) => unknown
  /** How the field's group labels, or the values summed up from it, are written. */
  format?: PivotFormat
  /** Groups in this order come first, in this order; the rest follow, sorted. */
  order?: readonly unknown[]
}

/** A field on the row or column axis: its name, or the name with options. */
export type PivotDimension =
  | string
  | {
      field: string
      /** By group label; `'asc'` (the default) puts Chinese in pinyin order and numbers by size. */
      sort?: 'asc' | 'desc'
      /** Whether its groups show a total of their own; `true` by default. */
      subtotal?: boolean
    }

/** The built-in ways to sum up a field. */
export type PivotAggregateName = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinct' | 'median'

/** A value to show: a field to sum up, or the name of a field (summed when numeric, counted otherwise). */
export type PivotValue =
  | string
  | {
      /** The field to sum up; leave out for `count` to count the records. */
      field?: string
      /** A built-in name or one from `defineAggregator`; `'sum'` for numbers, `'count'` otherwise. */
      aggregate?: PivotAggregateName | (string & {})
      /** The header; worked out from the field and the aggregate when left out. */
      label?: string
      /** How the value is written; the field's `format` when left out. */
      format?: PivotFormat
    }

/** Keeps only some groups of a field: those listed in `include`, or all but those in `exclude`. */
export interface PivotFilter {
  include?: readonly unknown[]
  exclude?: readonly unknown[]
}

/** Orders the row groups by the values in one column (what clicking a value header does). */
export interface PivotValueSort {
  /** Which value, by its place in `values`. */
  valueIndex: number
  /** The column's path of group labels; `[]` (the default) for the grand total. */
  column?: readonly unknown[]
  order: 'asc' | 'desc'
}

/** Which fields go where. Plain data, so it can be saved and sent to a worker. */
export interface PivotConfig {
  rows?: readonly PivotDimension[]
  columns?: readonly PivotDimension[]
  /** Leave empty to count the records. */
  values?: readonly PivotValue[]
  filters?: Readonly<Record<string, PivotFilter>>
  /** Where the values go when there are several; `'columns'` by default. */
  valuesOn?: 'columns' | 'rows'
  sort?: PivotValueSort | null
  /** The grand total row and column; both shown by default. */
  totals?: { rows?: boolean; columns?: boolean }
}

/** A group's labels from the outermost field in. */
export type PivotPath = readonly unknown[]

/** The groups that are collapsed, by their paths. */
export interface PivotCollapsed {
  rows?: readonly PivotPath[]
  columns?: readonly PivotPath[]
}
