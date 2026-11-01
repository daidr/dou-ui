import { computed, inject, onScopeDispose, provide, shallowRef, watch } from 'vue'
import type { SheetWorkbook } from '@dou-ui/sheet/core'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { DashboardWidget } from '../core/types'
import { dataContextKey } from '../data/context'
import { pickFilters } from '../data/filters'
import type { SourceEntry } from '../data/store'
import type { DashboardFilters, DashboardSetFilterOptions } from '../data/types'

/** What a widget shows instead of, or over, its content. */
export type DashboardWidgetState = 'ready' | 'loading' | 'error' | 'empty'

export interface DashboardWidgetStatus {
  state: DashboardWidgetState
  /** For `error` and `empty`: the line shown. */
  message?: string
  /** For `error`: what the retry button does; without it there is no button. */
  retry?: () => void
}

export interface DashboardWidgetContext<P extends object = Record<string, unknown>, D = unknown> {
  /** The widget as stored in the document. */
  widget: ComputedRef<DashboardWidget<P>>
  /** Its `props`, `{}` when it has none. */
  props: ComputedRef<P>
  /** Whether the dashboard is being edited. */
  editing: ComputedRef<boolean>
  /** Whether this is the full-screen view of the widget. */
  fullscreen: ComputedRef<boolean>
  /** The size of the widget's content area, in px; updated once a frame at most. */
  size: { width: Ref<number>; height: Ref<number> }
  /**
   * Merges keys into the widget's `props`, as one undoable change. Changes
   * with the same `group` within a second undo together.
   */
  setProps: (patch: Partial<P>, options?: { group?: string }) => void
  /**
   * What the frame shows: a loading mark over the content, an error, or an
   * empty notice. Loading and failing to load `props.source` come first.
   */
  status: Readonly<Ref<DashboardWidgetStatus>>
  setStatus: (state: DashboardWidgetState, options?: Omit<DashboardWidgetStatus, 'state'>) => void
  /**
   * The data of the source named in `props.source`, loaded with the filters
   * in effect. While new data loads, the last data stays.
   */
  data: Readonly<Ref<D | undefined>>
  /** Why the source failed to load, if it did. */
  error: Readonly<Ref<unknown>>
  /** The filters in effect for this widget: all of them but those it set itself. */
  filters: ComputedRef<DashboardFilters>
  /**
   * Sets a filter for the other widgets, e.g. when a bar of a chart is
   * clicked; an empty value (`undefined`, `null`, `''`, `[]`) clears it.
   * The widget itself keeps showing everything, and its title bar shows
   * the filter with a button to clear it.
   */
  setFilter: (key: string, value: unknown, options?: DashboardSetFilterOptions) => void
  /** The filters this widget set itself and that are still in effect, e.g. to mark the picked bar. */
  ownFilters: ComputedRef<DashboardFilters>
  /** Loads the widget's source again. */
  refresh: () => void
  /** The names of the dashboard's sources, e.g. to pick one in a settings form. */
  sources: ComputedRef<string[]>
  /**
   * Gives the dashboard the widget's content as a workbook, read when it is
   * exported with one of the dashboard's `exporters`; a sheet without a
   * name takes the widget's title. Returning `undefined` fails the export
   * with "no data to export"; `null` takes the export menu away, such as
   * while the widget isn't set up. A widget that never calls it has no
   * export menu. Undone when the widget goes.
   */
  setWorkbook: (get: (() => SheetWorkbook | undefined) | null) => void
}

export const widgetContextKey: InjectionKey<DashboardWidgetContext<any, any>> =
  Symbol('dou-dashboard-widget')

/** The widget a component is drawn in, for widget types' `component` and `settings`. */
export function useDashboardWidget<
  P extends object = Record<string, unknown>,
  D = unknown,
>(): DashboardWidgetContext<P, D> {
  const context = inject(widgetContextKey, null)
  if (!context) throw new Error('useDashboardWidget() is only available inside a dashboard widget')
  return context as DashboardWidgetContext<P, D>
}

interface ContextSource {
  widget: () => DashboardWidget
  editing: () => boolean
  fullscreen: () => boolean
  size: { width: Ref<number>; height: Ref<number> }
  setProps: (id: string, patch: Record<string, unknown>, options?: { group?: string }) => void
  setWorkbook?: (id: string, get: () => SheetWorkbook | undefined) => () => void
}

const NONE: DashboardFilters = Object.freeze({}) as DashboardFilters

/** Makes the context of one widget and provides it to the components below. */
export function provideWidgetContext(source: ContextSource): DashboardWidgetContext {
  const data = inject(dataContextKey, null)
  const own = shallowRef<DashboardWidgetStatus>({ state: 'ready' })
  const widget = computed(source.widget)
  const id = computed(() => widget.value.id)

  const filters = computed(() =>
    data ? pickFilters(data.filters(), undefined, data.emitted(id.value)) : NONE,
  )
  const ownFilters = computed(() => {
    const result: DashboardFilters = {}
    for (const link of data?.linked(id.value) ?? []) result[link.key] = link.value
    return result
  })
  const sourceName = computed(() => {
    const name = widget.value.props?.source
    return typeof name === 'string' && name ? name : undefined
  })

  // the widget shows the entry of its source and filters; another widget
  // with the same source and filters shows the same entry
  const entry = shallowRef<SourceEntry>()
  let release: (() => void) | undefined
  const key = computed(() =>
    data && sourceName.value ? data.store.keyOf(sourceName.value, filters.value).key : '',
  )
  watch(
    key,
    () => {
      const next =
        data && sourceName.value ? data.store.use(sourceName.value, filters.value) : undefined
      release?.()
      release = next?.release
      entry.value = next?.entry
    },
    { immediate: true },
  )
  onScopeDispose(() => release?.())

  const state = computed(() => entry.value?.state.value)
  /** The last data loaded, kept while other data loads. */
  const held = shallowRef<unknown>()
  watch(
    state,
    (next) => {
      if (!entry.value) held.value = undefined
      else if (next?.status === 'ready') held.value = next.data
    },
    { immediate: true },
  )
  const error = computed(() => (state.value?.status === 'error' ? state.value.error : undefined))
  const refresh = () => entry.value && data?.store.retry(entry.value)

  const status = computed<DashboardWidgetStatus>(() => {
    const current = state.value
    if (current?.status === 'loading' || current?.status === 'idle') return { state: 'loading' }
    if (current?.status === 'error') return { state: 'error', retry: refresh }
    return own.value
  })

  const context: DashboardWidgetContext = {
    widget,
    props: computed(() => widget.value.props ?? {}),
    editing: computed(source.editing),
    fullscreen: computed(source.fullscreen),
    size: source.size,
    setProps: (patch, options) => source.setProps(id.value, patch, options),
    status,
    setStatus: (next, options) => (own.value = { state: next, ...options }),
    data: held,
    error,
    filters,
    setFilter: (name, value, options) => data?.setFilter(id.value, name, value, options),
    ownFilters,
    refresh,
    sources: computed(() => data?.sourceNames() ?? []),
    setWorkbook: (get) => {
      undoWorkbook?.()
      undoWorkbook = get ? source.setWorkbook?.(id.value, get) : undefined
    },
  }
  let undoWorkbook: (() => void) | undefined
  onScopeDispose(() => undoWorkbook?.())
  provide(widgetContextKey, context)
  return context
}
