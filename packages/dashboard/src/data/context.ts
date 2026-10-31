import type { InjectionKey } from 'vue'
import type { SourceStore } from './store'
import type { DashboardFilters, DashboardLinkedFilter, DashboardSetFilterOptions } from './types'

/** What widgets read from their dashboard about data and filters. */
export interface DataContext {
  store: SourceStore
  /** The names of the dashboard's sources. */
  sourceNames: () => string[]
  /** Every filter value, as bound with `v-model:filters`. */
  filters: () => DashboardFilters
  /** The keys of the filters a widget set itself, which it doesn't see. */
  emitted: (id: string) => ReadonlySet<string>
  /** The filters a widget set itself, for its title bar. */
  linked: (id: string) => DashboardLinkedFilter[]
  /** Sets (or clears, with an empty value) a filter; `widget` is the widget setting it, if any. */
  setFilter: (
    widget: string | undefined,
    key: string,
    value: unknown,
    options?: DashboardSetFilterOptions,
  ) => void
}

export const dataContextKey: InjectionKey<DataContext> = Symbol('dou-dashboard-data')
