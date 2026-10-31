import { computed, inject, provide, shallowRef } from 'vue'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { DashboardWidget } from '../core/types'

/** What a widget shows instead of, or over, its content. */
export type DashboardWidgetState = 'ready' | 'loading' | 'error' | 'empty'

export interface DashboardWidgetStatus {
  state: DashboardWidgetState
  /** For `error` and `empty`: the line shown. */
  message?: string
  /** For `error`: what the retry button does; without it there is no button. */
  retry?: () => void
}

export interface DashboardWidgetContext<P extends object = Record<string, unknown>> {
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
  /** What the frame shows: a loading mark over the content, an error, or an empty notice. */
  status: Readonly<Ref<DashboardWidgetStatus>>
  setStatus: (state: DashboardWidgetState, options?: Omit<DashboardWidgetStatus, 'state'>) => void
}

export const widgetContextKey: InjectionKey<DashboardWidgetContext<any>> =
  Symbol('dou-dashboard-widget')

/** The widget a component is drawn in, for widget types' `component` and `settings`. */
export function useDashboardWidget<
  P extends object = Record<string, unknown>,
>(): DashboardWidgetContext<P> {
  const context = inject(widgetContextKey, null)
  if (!context) throw new Error('useDashboardWidget() is only available inside a dashboard widget')
  return context as DashboardWidgetContext<P>
}

interface ContextSource {
  widget: () => DashboardWidget
  editing: () => boolean
  fullscreen: () => boolean
  size: { width: Ref<number>; height: Ref<number> }
  setProps: (id: string, patch: Record<string, unknown>, options?: { group?: string }) => void
}

/** Makes the context of one widget and provides it to the components below. */
export function provideWidgetContext(source: ContextSource): DashboardWidgetContext {
  const status = shallowRef<DashboardWidgetStatus>({ state: 'ready' })
  const context: DashboardWidgetContext = {
    widget: computed(source.widget),
    props: computed(() => source.widget().props ?? {}),
    editing: computed(source.editing),
    fullscreen: computed(source.fullscreen),
    size: source.size,
    setProps: (patch, options) => source.setProps(source.widget().id, patch, options),
    status,
    setStatus: (state, options) => (status.value = { state, ...options }),
  }
  provide(widgetContextKey, context)
  return context
}
