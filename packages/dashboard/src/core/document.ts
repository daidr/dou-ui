import type { DashboardWidgetType } from '../widget/define'
import type { DashboardDocument, DashboardPlace, DashboardWidget } from './types'

export interface DocumentProblem {
  code: 'version' | 'duplicate-id' | 'missing-id' | 'unknown-type' | 'bad-place'
  /** The widget at fault; none for the document's own problems. */
  widgetId?: string
  /** Where the problem is, e.g. `widgets[2]` or `widgets[2].place.lg`; `version` for the version. */
  path: string
  /** The id, type or breakpoint at fault, for the editor's message. */
  text: string
  /** An English description, for logs. */
  message: string
}

export interface CheckDocumentOptions {
  /** The registered widget types; without them, types are not checked. */
  widgets?: readonly DashboardWidgetType<any>[]
}

const isCount = (value: unknown, min: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min

/** Whether `value` is a place on a grid: whole numbers, the size at least 1. */
export function isDashboardPlace(value: unknown): value is DashboardPlace {
  if (!value || typeof value !== 'object') return false
  const place = value as Record<string, unknown>
  return isCount(place.x, 0) && isCount(place.y, 0) && isCount(place.w, 1) && isCount(place.h, 1)
}

/**
 * The problems of a dashboard document, before it is saved or shown: an
 * unknown version, widgets without an id or sharing one, types nobody
 * registered, and places that are not whole cells.
 */
export function checkDocument(
  document: DashboardDocument,
  options: CheckDocumentOptions = {},
): DocumentProblem[] {
  const problems: DocumentProblem[] = []
  if (document.version !== 1)
    problems.push({
      code: 'version',
      path: 'version',
      text: String(document.version),
      message: `Version ${String(document.version)} is not known`,
    })
  const types = options.widgets && new Set(options.widgets.map((type) => type.type))
  const ids = new Set<string>()
  document.widgets.forEach((widget, i) => {
    const path = `widgets[${i}]`
    if (!widget.id) {
      problems.push({ code: 'missing-id', path, text: '', message: `${path} has no id` })
    } else if (ids.has(widget.id)) {
      problems.push({
        code: 'duplicate-id',
        widgetId: widget.id,
        path,
        text: widget.id,
        message: `The id "${widget.id}" is used more than once`,
      })
    }
    ids.add(widget.id)
    if (types && !types.has(widget.type))
      problems.push({
        code: 'unknown-type',
        widgetId: widget.id,
        path,
        text: widget.type,
        message: `No widget type "${widget.type}" is registered`,
      })
    for (const [name, place] of Object.entries(widget.place ?? {}))
      if (place !== undefined && !isDashboardPlace(place))
        problems.push({
          code: 'bad-place',
          widgetId: widget.id,
          path: `${path}.place.${name}`,
          text: name,
          message: `The place of "${widget.id}" on "${name}" is not whole cells`,
        })
  })
  return problems
}

/**
 * Brings a saved document up to the current version, and fills what an
 * older or hand-written one may lack (`version`, `place`). Widgets that are
 * not objects and places that are not whole cells are dropped; anything
 * else is kept as it is. Throws for a version newer than this one knows.
 */
export function migrateDocument(input: unknown): DashboardDocument {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const version = source.version ?? 1
  if (version !== 1) throw new Error(`Dashboard version ${String(version)} is not known`)
  const list = Array.isArray(source.widgets) ? source.widgets : []
  const widgets: DashboardWidget[] = []
  for (const value of list) {
    if (!value || typeof value !== 'object') continue
    const widget = value as Record<string, unknown>
    const place: DashboardWidget['place'] = {}
    if (widget.place && typeof widget.place === 'object')
      for (const [name, entry] of Object.entries(widget.place))
        if (isDashboardPlace(entry))
          place[name] = { x: entry.x, y: entry.y, w: entry.w, h: entry.h }
    widgets.push({
      ...widget,
      id: String(widget.id ?? ''),
      type: String(widget.type ?? ''),
      place,
    } as DashboardWidget)
  }
  return { ...source, version: 1, widgets } as DashboardDocument
}
