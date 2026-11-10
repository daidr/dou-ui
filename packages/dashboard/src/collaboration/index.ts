import { collaborationColors } from 'dou-ui'
import { shallowRef } from 'vue'
import * as Y from 'yjs'
import type {
  DashboardCollaboration,
  DashboardCollaborationHost,
  DashboardPeer,
  DashboardPresence,
} from '../core/collaboration'
import { sameValue, type DashboardTransaction } from '../core/transaction'
import type { DashboardDocument, DashboardWidget } from '../core/types'
import { keptIndexes, orderKeys } from './order'

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

/** Whether two JSON values are the same, whatever the order of their keys. */
const same = sameValue

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

/** Runs `write` as one transaction of the map's document, from `origin`. */
function transact(map: Shared, write: () => void, origin: unknown) {
  if (map.doc) map.doc.transact(write, origin ?? null)
  else write()
}

export interface FillMapOptions {
  /** The origin of the Yjs transaction, so the others can tell who wrote it. */
  origin?: unknown
}

/**
 * Writes a dashboard into an empty map, e.g. when a dashboard so far saved
 * as JSON starts being edited together. Do it once, where the shared
 * document is created; otherwise the first person to open the dashboard
 * brings theirs.
 */
export function fillMap(
  map: Y.Map<unknown>,
  document: DashboardDocument,
  options: FillMapOptions = {},
) {
  const fill = () => {
    for (const widget of document.widgets) writeWidget(map, widget)
    writeOrder(map, document.widgets)
  }
  transact(map, fill, options.origin)
}

/** Writes the keys and places that differ between `before` and `after` into a widget's map. */
function writeDifference(fields: Shared, before: DashboardWidget, after: DashboardWidget) {
  const a = before as unknown as Item
  const b = after as unknown as Item
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'id' || key[0] === '$') continue
    if (key === PLACE) {
      const from = before.place ?? {}
      const to = after.place ?? {}
      const found = fields.get(PLACE)
      let places = found instanceof Y.Map ? (found as Shared) : null
      for (const name of new Set([...Object.keys(from), ...Object.keys(to)])) {
        if (same(from[name], to[name])) continue
        if (!places) fields.set(PLACE, (places = new Y.Map<unknown>()))
        const place = to[name]
        if (place) places.set(name, { ...place })
        else places.delete(name)
      }
    } else if (!same(a[key], b[key])) {
      if (b[key] === undefined) fields.delete(key)
      else {
        warnUnshareable(after.id, key, b[key])
        fields.set(key, b[key])
      }
    }
  }
}

/**
 * Gives `placing` (widgets added or moved in `next`) order keys among the
 * widgets as they are ordered in the map now: right after the widget before
 * them in `next`; those before the first widget that stays go right before
 * it, and those after the last one go after all the others. Everyone else
 * keeps their key.
 */
function placeOrder(map: Shared, next: readonly DashboardWidget[], placing: Set<string>) {
  if (!placing.size) return
  const list = readMap(map)
    .widgets.map((widget) => widget.id)
    .filter((id) => !placing.has(id))
  const listed = new Set(list)
  const stays = (id: string) => listed.has(id)
  let last = -1
  next.forEach((widget, index) => {
    if (stays(widget.id)) last = index
  })
  const leading: string[] = []
  const trailing: string[] = []
  const after = new Map<string, string[]>()
  let first: string | null = null
  let previous: string | null = null
  next.forEach((widget, index) => {
    if (stays(widget.id)) {
      first ??= widget.id
      previous = widget.id
    } else if (placing.has(widget.id)) {
      if (index > last) trailing.push(widget.id)
      else if (previous === null) leading.push(widget.id)
      else {
        const attached = after.get(previous)
        if (attached) attached.push(widget.id)
        else after.set(previous, [widget.id])
      }
    }
  })
  const ordered: string[] = []
  for (const id of list) {
    if (id === first) ordered.push(...leading)
    ordered.push(id, ...(after.get(id) ?? []))
  }
  ordered.push(...trailing)
  const shared = ordered.map((id) => map.get(id) as Shared)
  const keys = orderKeys(
    shared.map((fields, index) =>
      placing.has(ordered[index]!) ? null : ((fields.get(ORDER) as string | undefined) ?? null),
    ),
  )
  shared.forEach((fields, index) => {
    if (fields.get(ORDER) !== keys[index]) fields.set(ORDER, keys[index])
  })
}

/**
 * While developing: each widget `readMap` gave, as it was then, to tell a
 * widget of `base` changed in place from one others changed meanwhile.
 */
const asRead = new WeakMap<object, unknown>()

/** The widgets of `next` that can be written: each id once, each with a type. */
function writable(next: DashboardDocument, base: DashboardDocument | undefined) {
  const dev = process.env.NODE_ENV !== 'production'
  if (dev && base && (next === base || next.widgets === base.widgets))
    console.warn(
      '[@dou-ui/dashboard] updateMap got the same object as `next` and `base`, so nothing is written: change a copy of `base`, e.g. structuredClone(base).',
    )
  else if (dev && base) {
    // a widget of base that is no longer as `readMap` gave it was changed in place
    const kept = new Set<DashboardWidget>(base.widgets)
    for (const widget of next.widgets) {
      const snapshot = kept.has(widget) ? asRead.get(widget) : undefined
      if (!snapshot || same(snapshot, widget)) continue
      console.warn(
        `[@dou-ui/dashboard] updateMap got the widget "${widget.id}" of \`base\` itself in \`next\`, changed in place: the change isn't written. Change a copy of \`base\`, e.g. structuredClone(base).`,
      )
      break
    }
  }
  const seen = new Set<string>()
  return next.widgets.filter((widget) => {
    if (typeof widget.type !== 'string') {
      if (dev)
        console.warn(
          `[@dou-ui/dashboard] updateMap skips "${widget.id}": a widget needs a \`type\`.`,
        )
      return false
    }
    if (seen.has(widget.id)) {
      if (dev)
        console.warn(
          `[@dou-ui/dashboard] updateMap skips the second widget "${widget.id}": ids must be unique.`,
        )
      return false
    }
    seen.add(widget.id)
    return true
  })
}

export interface UpdateMapOptions extends FillMapOptions {
  /**
   * The version `next` was made from, e.g. the one read with `readMap` and
   * given to a program that took a while to write `next`. Only what differs
   * between `base` and `next` is written: added and removed widgets, changed
   * keys, places on the breakpoints that changed, and the order of the
   * widgets that moved. What others changed meanwhile stays. Left out, the
   * map as it is now: then every widget not in `next` is removed.
   */
  base?: DashboardDocument
}

/**
 * Change a shared map from `options.base` to `next`, without a dashboard,
 * e.g. on the server when a program wrote a new version while people edit
 * the dashboard. Only what differs is written.
 */
export function updateMap(
  map: Y.Map<unknown>,
  next: DashboardDocument,
  options: UpdateMapOptions = {},
) {
  // a map not in a document can't be read, so nothing could be merged
  if (!map.doc) throw new Error('[@dou-ui/dashboard] updateMap needs a map of a Y.Doc')
  const update = () => {
    const base = options.base ?? readMap(map)
    const widgets = writable(next, options.base)
    const before = new Map(base.widgets.map((widget) => [widget.id, widget]))
    const ids = new Set(next.widgets.map((widget) => widget.id))
    for (const id of before.keys()) if (!ids.has(id)) map.delete(id)

    // the widgets both have, in `base`'s order: those out of it in `next` moved
    const index = new Map(base.widgets.map((widget, i) => [widget.id, i]))
    const common = widgets.filter((widget) => index.has(widget.id))
    const kept = keptIndexes(common.map((widget) => String(index.get(widget.id)).padStart(10, '0')))
    const placing = new Set(common.filter((_, i) => !kept.has(i)).map((widget) => widget.id))

    for (const widget of widgets) {
      const old = before.get(widget.id)
      const fields = map.get(widget.id)
      if (!old) {
        writeWidget(map, widget)
        placing.add(widget.id)
      } else if (fields instanceof Y.Map) writeDifference(fields, old, widget)
      // removed meanwhile by someone else: it stays removed
      else placing.delete(widget.id)
    }
    placeOrder(map, widgets, placing)
  }
  transact(map, update, options.origin)
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
  const widgets = list.map((entry) => entry.widget)
  if (process.env.NODE_ENV !== 'production')
    for (const widget of widgets) asRead.set(widget, structuredClone(widget))
  return { version: 1, widgets }
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
