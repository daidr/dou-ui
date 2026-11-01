import { collaborationColors } from 'dou-ui'
import { shallowRef } from 'vue'
import * as Y from 'yjs'
import type {
  DashboardCollaboration,
  DashboardCollaborationHost,
  DashboardPeer,
  DashboardPresence,
} from '../core/collaboration'
import type { DashboardTransaction } from '../core/transaction'
import type { DashboardDocument, DashboardWidget } from '../core/types'
import { orderKeys } from './order'

/** The part of an `Awareness` (`y-protocols/awareness`) the dashboard uses. */
export interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | null
  setLocalStateField(field: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: 'change', listener: (...args: unknown[]) => void): void
  off(event: 'change', listener: (...args: unknown[]) => void): void
}

/** How the people editing together see each other. */
export interface CollaborationUser {
  name: string
  /** The color of this user's outlines, any CSS color. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the widgets live, e.g. `ydoc.getMap('widgets')`. */
  widgets: Y.Map<unknown>
  /** Shares which widget each person is at, and what they do there (`y-protocols/awareness`). */
  awareness?: AwarenessLike
  /** This user, shown to the others. Needs `awareness`. */
  user?: CollaborationUser
}

export { collaborationColors }
export type { DashboardPeer, DashboardPresence }

type Shared = Y.Map<unknown>
type Item = Record<string, unknown>

/** A widget's place among the others, kept beside its keys. */
const ORDER = '$order'
/** The places by breakpoint, a map of their own, so places on two breakpoints don't overwrite each other. */
const PLACE = 'place'

const same = (a: unknown, b: unknown) =>
  a === b ||
  (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b))

/** Where in `value` something JSON can't carry sits, e.g. a component or a function. */
function unshareable(value: unknown, path: string): string | null {
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value))
    return null
  if (typeof value !== 'object') return path
  const proto = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return path
  for (const [key, item] of Object.entries(value)) {
    const found = unshareable(item, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`)
    if (found) return found
  }
  return null
}

const warned = new Set<string>()
/** Others would get a broken copy of such a value while this dashboard shows it fine. */
function warnUnshareable(id: string, key: string, value: unknown) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production') return
  const path = unshareable(value, key)
  if (!path || warned.has(`${id}:${path}`)) return
  warned.add(`${id}:${path}`)
  console.warn(
    `[@dou-ui/dashboard] "${id}" has ${path}, which can't be shared: only JSON values reach the others.`,
  )
}

/** Writes the places that changed into a widget's place map. */
function writePlace(fields: Shared, place: DashboardWidget['place']) {
  const shared = fields.get(PLACE)
  if (!(shared instanceof Y.Map)) {
    const map = new Y.Map<unknown>()
    for (const [name, value] of Object.entries(place)) if (value) map.set(name, { ...value })
    fields.set(PLACE, map)
    return
  }
  for (const [name, value] of Object.entries(place))
    if (value && !same(shared.get(name), value)) shared.set(name, { ...value })
  for (const name of Array.from(shared.keys())) if (!place[name]) shared.delete(name)
}

/** Writes a widget's keys besides its order, only those that changed; `keys` limits which. */
function writeWidget(map: Shared, widget: DashboardWidget, keys?: Set<string>) {
  const existing = map.get(widget.id)
  const item = widget as unknown as Item
  if (!(existing instanceof Y.Map)) {
    // a new map can't be read before it is in the document: fill it, then put it in
    const fields = new Y.Map<unknown>()
    for (const [key, value] of Object.entries(item)) {
      if (key === 'id' || value === undefined) continue
      if (key === PLACE) {
        const places = new Y.Map<unknown>()
        for (const [name, place] of Object.entries(value as DashboardWidget['place']))
          if (place) places.set(name, { ...place })
        fields.set(PLACE, places)
        continue
      }
      warnUnshareable(widget.id, key, value)
      fields.set(key, value)
    }
    map.set(widget.id, fields)
    return
  }
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || value === undefined || (keys && !keys.has(key))) continue
    if (key === PLACE) writePlace(existing, value as DashboardWidget['place'])
    else if (!same(existing.get(key), value)) {
      warnUnshareable(widget.id, key, value)
      existing.set(key, value)
    }
  }
  for (const key of Array.from(existing.keys()))
    if (key[0] !== '$' && item[key] === undefined && (!keys || keys.has(key))) existing.delete(key)
}

/** Writes each widget's order key, giving new keys only where it must. */
function writeOrder(map: Shared, widgets: readonly DashboardWidget[]) {
  const shared = widgets.map((widget) => {
    const fields = map.get(widget.id)
    return fields instanceof Y.Map ? fields : null
  })
  const keys = orderKeys(shared.map((fields) => (fields?.get(ORDER) as string | undefined) ?? null))
  shared.forEach((fields, index) => {
    if (fields && fields.get(ORDER) !== keys[index]) fields.set(ORDER, keys[index])
  })
}

/**
 * Writes a dashboard into an empty map, e.g. when a dashboard so far saved
 * as JSON starts being edited together. Do it once, where the shared
 * document is created; otherwise the first person to open the dashboard
 * brings theirs.
 */
export function fillMap(map: Y.Map<unknown>, document: DashboardDocument) {
  const fill = () => {
    for (const widget of document.widgets) writeWidget(map, widget)
    writeOrder(map, document.widgets)
  }
  if (map.doc) map.doc.transact(fill)
  else fill()
}

/** The dashboard the map holds: its widgets by their order keys (then ids, the same for everyone). */
export function readMap(map: Y.Map<unknown>): DashboardDocument {
  const list: { widget: DashboardWidget; order: string }[] = []
  map.forEach((value, id) => {
    if (!(value instanceof Y.Map)) return
    const { [ORDER]: order, ...rest } = value.toJSON() as Item
    if (typeof rest.type !== 'string') return
    const place = rest[PLACE]
    list.push({
      widget: {
        ...rest,
        id,
        place: place && typeof place === 'object' ? place : {},
      } as DashboardWidget,
      order: typeof order === 'string' ? order : '',
    })
  })
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the list built here
  list.sort((a, b) =>
    a.order < b.order ? -1 : a.order > b.order ? 1 : a.widget.id < b.widget.id ? -1 : 1,
  )
  return { version: 1, widgets: list.map((entry) => entry.widget) }
}

/** The widgets and keys a transaction changed, written to the map. */
function writeChanges(map: Shared, tr: DashboardTransaction) {
  const after = new Map(tr.doc.widgets.map((widget) => [widget.id, widget]))
  const touched = new Map<string, Set<string> | true>()
  let added = false
  let removed = false
  for (const step of tr.steps) {
    if (step.type === 'add') {
      touched.set(step.widget.id, true)
      added = true
    } else if (step.type === 'remove') {
      removed = true
      touched.delete(step.id)
    } else {
      const current = touched.get(step.id)
      if (current === true) continue
      const keys = current ?? new Set<string>()
      for (const key of Object.keys(step.patch)) keys.add(key)
      touched.set(step.id, keys)
    }
  }
  if (removed)
    for (const widget of tr.before.widgets) if (!after.has(widget.id)) map.delete(widget.id)
  for (const [id, keys] of touched) {
    const widget = after.get(id)
    if (!widget) continue
    // a widget removed and added again in one change is written anew
    if (keys === true && map.get(id) instanceof Y.Map && removed) map.delete(id)
    writeWidget(map, widget, keys === true ? undefined : keys)
  }
  if (added) writeOrder(map, tr.doc.widgets)
}

const NO_PEERS: readonly DashboardPeer[] = []

/**
 * Edit a dashboard together through a Yjs document: pass the result to
 * `DouDashboard` as `collaboration`. Each widget lives in `widgets` as its
 * own `Y.Map`, each key on its own and each breakpoint's place on its own,
 * so two people changing different widgets, or different settings of one,
 * both keep their change. When two people move widgets at once, everyone
 * lays the places out the same way, so the dashboards agree. While a widget
 * is dragged, changes from others wait until it is let go. The dashboard's
 * `v-model` only mirrors the shared document: a document set through
 * `v-model` from outside is not written back. Undo only takes back this
 * user's own changes. With `awareness`, each person sees which widget the
 * others are at, outlined in their colors, and whether they are moving,
 * resizing or changing its settings.
 */
export function collaboration(options: CollaborationOptions): DashboardCollaboration {
  const { widgets: map, awareness, user } = options
  const ydoc = map.doc
  if (!ydoc) throw new Error('[@dou-ui/dashboard] widgets must be a map of a Y.Doc')
  if (awareness && user) {
    const color = user.color ?? collaborationColors[ydoc.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }

  /** This dashboard's own changes, which undo can take back. */
  const tracked = { dashboard: 'tracked' }
  /** Changes undo leaves alone, e.g. filling the map. */
  const untracked = { dashboard: 'untracked' }
  const undoManager = new Y.UndoManager([map], {
    trackedOrigins: new Set([tracked]),
    captureTimeout: 500,
  })
  /** Bumped when the undo stacks change, so `canUndo` and `canRedo` update. */
  const stacks = shallowRef(0)
  const bump = () => stacks.value++
  undoManager.on('stack-item-added', bump)
  undoManager.on('stack-item-popped', bump)
  undoManager.on('stack-cleared', bump)

  let host: DashboardCollaborationHost | undefined
  /** What undo or redo is running, to name the change. */
  let travelling: 'undo' | 'redo' | null = null
  let lastGroup: string | undefined

  /** Brings the dashboard in line with the map. */
  function pull() {
    host?.apply(readMap(map), travelling ?? 'remote')
  }

  function run(action: 'undo' | 'redo') {
    const stack = action === 'undo' ? undoManager.undoStack : undoManager.redoStack
    if (!stack.length) return false
    travelling = action
    try {
      undoManager[action]()
    } finally {
      travelling = null
    }
    return true
  }

  /** The others at each widget. */
  const peersByWidget = shallowRef(new Map<string, DashboardPeer[]>())
  function readPeers() {
    if (!awareness) return
    const next = new Map<string, DashboardPeer[]>()
    awareness.getStates().forEach((state, client) => {
      if (client === awareness.clientID) return
      const who = state.user as { name?: string; color?: string } | undefined
      const presence = state.dashboard as DashboardPresence | null | undefined
      if (!who || !presence?.widget) return
      const peer: DashboardPeer = {
        client,
        name: who.name ?? '',
        color: who.color ?? 'currentColor',
        action: presence.action,
      }
      const list = next.get(presence.widget)
      if (list) list.push(peer)
      else next.set(presence.widget, [peer])
    })
    peersByWidget.value = next
  }

  return {
    setup(dashboard) {
      host = dashboard
      // the first one to open the dashboard brings its widgets; everyone else reads the map
      if (!map.size) ydoc.transact(() => fillMap(map, dashboard.document()), untracked)
      pull()

      // changes from others, and from undo: applied once per Yjs transaction
      let dirty = false
      const observe = (_events: unknown, transaction: Y.Transaction) => {
        if (transaction.origin !== tracked && transaction.origin !== untracked) dirty = true
      }
      const flush = () => {
        if (!dirty) return
        dirty = false
        pull()
      }
      map.observeDeep(observe)
      ydoc.on('afterTransaction', flush)
      if (awareness) {
        readPeers()
        awareness.on('change', readPeers)
      }
      return () => {
        map.unobserveDeep(observe)
        ydoc.off('afterTransaction', flush)
        if (awareness) awareness.off('change', readPeers)
        host = undefined
      }
    },
    transaction(tr) {
      const tracking = tr.meta.history !== false
      // like the dashboard's own history: only changes of one group undo together
      if (tracking && (!tr.meta.group || tr.meta.group !== lastGroup)) undoManager.stopCapturing()
      if (tracking) lastGroup = tr.meta.group
      ydoc.transact(() => writeChanges(map, tr), tracking ? tracked : untracked)
    },
    sync: pull,
    undo: () => run('undo'),
    redo: () => run('redo'),
    canUndo: () => (stacks.value, undoManager.undoStack.length > 0),
    canRedo: () => (stacks.value, undoManager.redoStack.length > 0),
    presence: awareness
      ? (presence) => awareness.setLocalStateField('dashboard', presence)
      : undefined,
    peers: awareness ? (id) => peersByWidget.value.get(id) ?? NO_PEERS : undefined,
  }
}
