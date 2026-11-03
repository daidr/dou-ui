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

/** Applies one step: the new document and the step that undoes it, or `null` when it changes nothing. */
function applyStep(
  document: DashboardDocument,
  step: DashboardStep,
): [DashboardDocument, DashboardStep, DashboardStep] | null {
  const widgets = document.widgets
  const indexOf = (id: string) => widgets.findIndex((widget) => widget.id === id)
  if (step.type === 'add') {
    if (indexOf(step.widget.id) >= 0) return null
    const index = Math.max(0, Math.min(widgets.length, step.index))
    const next = [...widgets.slice(0, index), step.widget, ...widgets.slice(index)]
    return [
      { ...document, widgets: next },
      { ...step, index },
      { type: 'remove', id: step.widget.id },
    ]
  }
  const index = indexOf(step.id)
  if (index < 0) return null
  const widget = widgets[index]!
  if (step.type === 'remove') {
    const next = [...widgets.slice(0, index), ...widgets.slice(index + 1)]
    return [{ ...document, widgets: next }, step, { type: 'add', widget, index }]
  }
  const old = widget as unknown as Record<string, unknown>
  const changed: Record<string, unknown> = { ...old }
  const patch: Record<string, unknown> = {}
  const undo: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(step.patch)) {
    if (PROTECTED.has(key))
      throw new Error(`[@dou-ui/dashboard] a widget's "${key}" cannot be changed`)
    if (sameValue(old[key], value)) continue
    patch[key] = value
    undo[key] = old[key]
    if (value === undefined) delete changed[key]
    else changed[key] = value
  }
  if (!Object.keys(patch).length) return null
  const next = widgets.slice()
  next[index] = changed as unknown as DashboardWidget
  return [
    { ...document, widgets: next },
    { type: 'update', id: step.id, patch: patch as DashboardWidgetPatch },
    { type: 'update', id: step.id, patch: undo as DashboardWidgetPatch },
  ]
}

/**
 * Changes to a dashboard, made step by step and then handed to the
 * dashboard's `dispatch` as one change (one undo step). A step that changes
 * nothing (a widget that isn't there, a patch to the same values, an id
 * already in use) is left out.
 *
 * ```ts
 * const tr = dashboard.value.transaction()
 * tr.update('orders', { title: '本周订单' }).remove('memo')
 * dashboard.value.dispatch(tr)
 * ```
 */
export class DashboardTransaction {
  /** The document after the steps so far. */
  doc: DashboardDocument
  readonly steps: DashboardStep[] = []
  /** The steps that undo the ones so far, last one first. */
  readonly inverse: DashboardStep[] = []
  readonly meta: DashboardTransactionMeta = {}

  constructor(
    /** The document the transaction starts from. */
    readonly before: DashboardDocument,
  ) {
    this.doc = before
  }

  /** Whether any step was made. */
  get changed() {
    return this.steps.length > 0
  }

  /** Apply a step as it is. */
  step(step: DashboardStep) {
    const result = applyStep(this.doc, step)
    if (!result) return this
    this.doc = result[0]
    this.steps.push(result[1])
    this.inverse.unshift(result[2])
    return this
  }

  /** Put a widget into the document at `index` (the end by default). */
  add(widget: DashboardWidget, index = Infinity) {
    return this.step({ type: 'add', widget, index })
  }

  /** Take a widget out. */
  remove(id: string) {
    return this.step({ type: 'remove', id })
  }

  /** Set keys of a widget, e.g. `{ title }`, `{ props }` or `{ place }`; `undefined` removes a key. */
  update(id: string, patch: DashboardWidgetPatch) {
    return this.step({ type: 'update', id, patch })
  }

  setMeta(key: string, value: unknown) {
    this.meta[key] = value
    return this
  }
}

/**
 * Applies steps to a document in one go, giving the transaction: its `doc`
 * (unchanged widgets are kept as they are) and the `inverse` steps that
 * undo it. For the server, tests, or saved steps.
 */
export function applySteps(
  document: DashboardDocument,
  steps: readonly DashboardStep[],
  meta: DashboardTransactionMeta = {},
): DashboardTransaction {
  const tr = new DashboardTransaction(document)
  Object.assign(tr.meta, meta)
  for (const step of steps) tr.step(step)
  return tr
}

/** A deep copy of a JSON value (also of a reactive one). */
export const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** The indexes of the longest strictly increasing run of `values`. */
function longestRun(values: readonly number[]): Set<number> {
  const tails: number[] = []
  const previous: number[] = []
  values.forEach((value, index) => {
    let low = 0
    let high = tails.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (values[tails[mid]!]! < value) low = mid + 1
      else high = mid
    }
    previous[index] = low > 0 ? tails[low - 1]! : -1
    tails[low] = index
  })
  const kept = new Set<number>()
  let index = tails.length ? tails[tails.length - 1]! : -1
  while (index >= 0) {
    kept.add(index)
    index = previous[index]!
  }
  return kept
}

/**
 * Adds the steps that turn the transaction's document into `next`: widgets
 * that are gone are removed, new ones added, changed keys updated, and the
 * fewest widgets taken out and put back to match the order. Unchanged
 * widgets keep their objects.
 */
export function replaceWidgets(tr: DashboardTransaction, next: DashboardDocument) {
  const wanted = new Map(next.widgets.map((widget, index) => [widget.id, index]))
  for (const widget of tr.doc.widgets) {
    const index = wanted.get(widget.id)
    // a widget whose type changed is a new widget
    if (index === undefined || next.widgets[index]!.type !== widget.type) tr.remove(widget.id)
  }
  const current = tr.doc.widgets
  const kept = longestRun(current.map((widget) => wanted.get(widget.id)!))
  for (const [index, widget] of current.entries()) if (!kept.has(index)) tr.remove(widget.id)
  next.widgets.forEach((widget, index) => {
    const there = tr.doc.widgets[index]
    if (there?.id !== widget.id) return void tr.add(widget, index)
    const patch: Record<string, unknown> = {}
    const old = there as unknown as Record<string, unknown>
    const item = widget as unknown as Record<string, unknown>
    for (const key of new Set([...Object.keys(old), ...Object.keys(item)]))
      if (!PROTECTED.has(key)) patch[key] = item[key]
    tr.update(widget.id, patch as DashboardWidgetPatch)
  })
  return tr
}
