/** The values of a dashboard's filters, by key. Bound with `v-model:filters`. */
export type DashboardFilters = Record<string, unknown>

export interface DashboardSourceContext {
  /** The filters in effect for the widgets asking: only the keys the source uses, without empty ones. */
  filters: DashboardFilters
  /** Aborted when no widget needs the result any more, e.g. after the filters changed. */
  signal: AbortSignal
  /** The source's name. */
  source: string
}

/** Loads a source's data; called once for each set of filters, however many widgets show it. */
export type DashboardSourceLoad<T = unknown> = (
  context: DashboardSourceContext,
) => T | PromiseLike<T>

export interface DashboardSourceOptions<T = unknown> {
  load: DashboardSourceLoad<T>
  /**
   * The filter keys it uses; other filters neither reach it nor load it
   * again. Defaults to every filter.
   */
  filters?: string[]
  /** Loads again every this many ms while it is shown; paused while the page is hidden. */
  refresh?: number
}

/** Where widgets get their data, by name. A widget names its source in `props.source`. */
export type DashboardSources = Record<
  string,
  DashboardSourceLoad<any> | DashboardSourceOptions<any>
>

/** A filter set by a widget, e.g. by clicking a bar of its chart. */
export interface DashboardLinkedFilter {
  key: string
  value: unknown
  /** How the value is shown, e.g. a name for an id. Defaults to the value. */
  label: string
  /** The widget that set it, which itself keeps showing everything. */
  widget: string
}

export interface DashboardSetFilterOptions {
  /** How the value is shown in the title bar and the filter bar. Defaults to the value. */
  label?: string
}

interface FilterFieldBase {
  /** The filter's key in `v-model:filters`. */
  key: string
  /** Shown before the control, and its accessible name. */
  label: string
}

/** A dropdown of values; with `multiple`, the value is an array. */
export interface DashboardSelectFilterField extends FilterFieldBase {
  type: 'select'
  /** Strings and numbers serve as both value and label. */
  options: ({ value: string | number; label?: string } | string | number)[]
  multiple?: boolean
  /** Shown while nothing is picked. Defaults to the locale's. */
  placeholder?: string
}

/** A range of days; the value is `['YYYY-MM-DD', 'YYYY-MM-DD']`. */
export interface DashboardDateRangeFilterField extends FilterFieldBase {
  type: 'date-range'
}

/** Typed text, applied once typing pauses. */
export interface DashboardSearchFilterField extends FilterFieldBase {
  type: 'search'
  placeholder?: string
}

/** A control in the filter bar. */
export type DashboardFilterField =
  DashboardSelectFilterField | DashboardDateRangeFilterField | DashboardSearchFilterField
