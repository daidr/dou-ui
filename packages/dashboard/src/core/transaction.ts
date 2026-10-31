import type { DashboardDocument, DashboardWidget } from './types'

/**
 * Keys of a widget to set; `undefined` removes the key. `id` and `type`
 * cannot be set: remove the widget and add another instead.
 */
export type DashboardWidgetPatch = { [key: string]: unknown } & {
  id?: never
  type?: never
}

/** One change to a dashboard. `index` is where in `widgets` an added widget goes. */
export type DashboardStep =
  | { type: 'add'; widget: DashboardWidget; index: number }
  | { type: 'remove'; id: string }
  | { type: 'update'; id: string; patch: DashboardWidgetPatch }

export interface DashboardTransactionMeta {
  /** `false` keeps the change out of undo, e.g. a change from another person. */
  history?: boolean
  /** Changes of the same group within a second become one undo step, e.g. typing in a setting. */
  group?: string
  /** Where the change came from: `layout`, `menu`, `keyboard`, `settings`, `api`… */
  origin?: string
  [key: string]: unknown
}

export interface DashboardTransaction {
  /** The document before. */
  before: DashboardDocument
  /** The document after; the same object as `before` when nothing changed. */
  doc: DashboardDocument
  steps: DashboardStep[]
  /** Steps that undo `steps`, in the order to apply them. */
  inverse: DashboardStep[]
  meta: DashboardTransactionMeta
  readonly changed: boolean
}

const PROTECTED = new Set(['id', 'type'])

/** Deep equality of JSON values; key order doesn't matter. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) =>
    sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/**
 * Applies steps to a document, giving a new document (unchanged widgets are
 * kept as they are) and the steps that undo them. A step on a widget that
 * isn't there, a patch that changes nothing, or an add of an id already in
 * use is skipped.
 */
export function applySteps(
  document: DashboardDocument,
  steps: readonly DashboardStep[],
  meta: DashboardTransactionMeta = {},
): DashboardTransaction {
  let widgets = document.widgets
  const done: DashboardStep[] = []
  const inverse: DashboardStep[] = []
  const indexOf = (id: string) => widgets.findIndex((widget) => widget.id === id)
  for (const step of steps) {
    if (step.type === 'add') {
      if (indexOf(step.widget.id) >= 0) continue
      const index = Math.max(0, Math.min(widgets.length, step.index))
      widgets = [...widgets.slice(0, index), step.widget, ...widgets.slice(index)]
      done.push({ ...step, index })
      inverse.unshift({ type: 'remove', id: step.widget.id })
    } else if (step.type === 'remove') {
      const index = indexOf(step.id)
      if (index < 0) continue
      const widget = widgets[index]!
      widgets = [...widgets.slice(0, index), ...widgets.slice(index + 1)]
      done.push(step)
      inverse.unshift({ type: 'add', widget, index })
    } else {
      const index = indexOf(step.id)
      if (index < 0) continue
      const widget = widgets[index]! as unknown as Record<string, unknown>
      const next: Record<string, unknown> = { ...widget }
      const patch: Record<string, unknown> = {}
      const undo: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(step.patch)) {
        if (PROTECTED.has(key)) throw new Error(`A widget's "${key}" cannot be changed`)
        if (sameValue(widget[key], value)) continue
        patch[key] = value
        undo[key] = widget[key]
        if (value === undefined) delete next[key]
        else next[key] = value
      }
      if (!Object.keys(patch).length) continue
      widgets = widgets.slice()
      widgets[index] = next as unknown as DashboardWidget
      done.push({ type: 'update', id: step.id, patch: patch as DashboardWidgetPatch })
      inverse.unshift({ type: 'update', id: step.id, patch: undo as DashboardWidgetPatch })
    }
  }
  const doc = done.length ? { ...document, widgets } : document
  return {
    before: document,
    doc,
    steps: done,
    inverse,
    meta,
    get changed() {
      return done.length > 0
    },
  }
}

/** A deep copy of a JSON value (also of a reactive one). */
export const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
