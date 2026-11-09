import { collaborationColors } from 'dou-ui'
import { toRaw, watch } from 'vue'
import * as Y from 'yjs'
import type { FlowEditorContext } from '../context'
import { defineFlowExtension, type FlowExtension } from '../core/extension'
import type { FlowDocument, FlowEdge, FlowNode } from '../core/model'
import type { FlowStep, FlowTransaction } from '../core/transaction'
import { createPeers, type AwarenessLike, type FlowPresence } from './peers'

/** How the people editing together see each other. */
export interface CollaborationUser {
  name: string
  /** The color of this user's outlines, any CSS color. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the nodes live, e.g. `ydoc.getMap('nodes')`. */
  nodes: Y.Map<unknown>
  /** Where the edges live, e.g. `ydoc.getMap('edges')`; in the same `Y.Doc` as `nodes`. */
  edges: Y.Map<unknown>
  /** Shares what each person selects, drags and connects (`y-protocols/awareness`). */
  awareness?: AwarenessLike
  /** This user, shown to the others. Needs `awareness`. */
  user?: CollaborationUser
}

export { collaborationColors }

type Shared = Y.Map<unknown>
type Item = Record<string, unknown>
/** The fields of one node or edge a change touched; `true` for all of them. */
type Touched = Map<string, Set<string> | true>

/** Whether a group is folded is each person's own view: it stays out of the shared document. */
const LOCAL_DATA = 'collapsed'

/** The keys JSON keeps: those whose value isn't `undefined`. */
const jsonKeys = (value: object) =>
  Object.keys(value).filter((key) => (value as Item)[key] !== undefined)

/** Whether two JSON values are the same, whatever the order of their keys. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a))
    return (
      a.length === (b as unknown[]).length && a.every((item, i) => same(item, (b as unknown[])[i]))
    )
  const keys = jsonKeys(a)
  if (keys.length !== jsonKeys(b).length) return false
  return keys.every((key) => same((a as Item)[key], (b as Item)[key]))
}

/** `data` as it is shared: without the local fields. */
function sharedData(data: unknown) {
  if (!data || typeof data !== 'object' || !(LOCAL_DATA in data)) return data
  const { [LOCAL_DATA]: _, ...rest } = data as Item
  return rest
}

/** A node or edge as the map holds it, or `null` when it holds none. */
function read<T>(map: Shared, id: string): T | null {
  const fields = map.get(id)
  if (!(fields instanceof Y.Map)) return null
  return { ...(fields.toJSON() as Item), id } as T
}

/** Where in `value` something JSON can't carry sits, e.g. a component or a function. */
function unshareable(value: unknown, path: string): string | null {
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value))
    return null
  if (typeof value !== 'object') return path
  const proto = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = unshareable(item, `${path}[${i}]`)
      if (found) return found
    }
    return null
  }
  if (proto !== Object.prototype && proto !== null) return path
  for (const [key, item] of Object.entries(value)) {
    const found = unshareable(item, `${path}.${key}`)
    if (found) return found
  }
  return null
}

const warned = new Set<string>()
/** Others would get a broken copy of such a value while this editor shows it fine. */
function warnUnshareable(id: string, key: string, value: unknown) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production') return
  const path = unshareable(value, key)
  if (!path || warned.has(`${id}:${path}`)) return
  warned.add(`${id}:${path}`)
  console.warn(
    `[@dou-ui/flow] "${id}" has ${path}, which can't be shared: only JSON values reach the others. Store a name and look the component or function up where it is drawn.`,
  )
}

let warnedDataUrl = false
/** A data URL goes into the shared document whole, to everyone, every time it loads. */
function warnDataUrl(data: unknown) {
  if (process.env.NODE_ENV === 'production' || warnedDataUrl || !data || typeof data !== 'object')
    return
  for (const value of Object.values(data))
    if (typeof value === 'string' && value.length > 100_000 && value.startsWith('data:')) {
      warnedDataUrl = true
      console.warn(
        `[@dou-ui/flow] a node keeps a data URL of ${Math.round(value.length / 1024)} KB, which every collaborator downloads with the document. Upload such files and keep their address instead, e.g. whiteboardKit({ upload }).`,
      )
      return
    }
}

/** Writes a node's or edge's fields, only those that changed; `keys` limits which. */
function write(map: Shared, value: FlowNode | FlowEdge, keys?: Set<string>) {
  const item = value as unknown as Item
  const existing = map.get(value.id)
  const fields: Shared = existing instanceof Y.Map ? existing : new Y.Map<unknown>()
  const fresh = existing !== fields
  for (const [key, raw] of Object.entries(item)) {
    if (key === 'id' || raw === undefined || (keys && !fresh && !keys.has(key))) continue
    const field = key === 'data' ? sharedData(raw) : raw
    warnUnshareable(value.id, key, field)
    if (key === 'data') warnDataUrl(field)
    // a new map can't be read before it is in the document
    if (fresh || !same(fields.get(key), field)) fields.set(key, field)
  }
  if (fresh) return void map.set(value.id, fields)
  for (const key of Array.from(fields.keys()))
    if (item[key] === undefined && (!keys || keys.has(key))) fields.delete(key)
}

/** The change that makes `local` match `shared`, leaving out `skip` and the local fields. */
function patchFor<T extends object>(local: T, shared: T, skip?: Set<string>) {
  const a = local as Item
  const b = shared as Item
  const patch: Item = {}
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'id' || skip?.has(key)) continue
    if (key === 'data') {
      if (same(sharedData(a.data), b.data)) continue
      // keep this person's folding
      const mine = (a.data as Item | undefined)?.[LOCAL_DATA]
      patch.data = mine === undefined ? b.data : { ...(b.data as Item), [LOCAL_DATA]: mine }
    } else if (!same(a[key], b[key])) patch[key] = b[key]
  }
  return Object.keys(patch).length ? (patch as Partial<T>) : null
}

type Maps = { nodes: Y.Map<unknown>; edges: Y.Map<unknown> }

/** Runs `run` as one transaction of the maps' document, from `origin`. */
function transact(maps: Maps, run: () => void, origin: unknown) {
  const ydoc = maps.nodes.doc
  if (ydoc) ydoc.transact(run, origin ?? null)
  else run()
}

export interface FillMapsOptions {
  /** The origin of the Yjs transaction, so the others can tell who wrote it. */
  origin?: unknown
}

/**
 * Writes nodes and edges into empty maps, e.g. when a flow that so far was
 * saved as JSON starts being edited together. Do it once, where the shared
 * document is created.
 */
export function fillMaps(maps: Maps, doc: FlowDocument, options: FillMapsOptions = {}) {
  const fill = () => {
    for (const node of doc.nodes) write(maps.nodes, node)
    for (const edge of doc.edges) write(maps.edges, edge)
  }
  transact(maps, fill, options.origin)
}

/** Every node or edge a map holds. */
function readAll<T>(map: Shared): T[] {
  return Array.from(map.keys(), (id) => read<T>(map, id)).filter((item): item is T => !!item)
}

/**
 * The flow the maps hold, read without an editor, e.g. to save a version
 * on the server. The order of the nodes and edges is not fixed: it may
 * differ between two reads, and from one client to another.
 */
export function readMaps(maps: Maps): FlowDocument {
  return { version: 1, nodes: readAll<FlowNode>(maps.nodes), edges: readAll<FlowEdge>(maps.edges) }
}

/** The fields that differ between two versions of a node or edge. */
function changedKeys(before: Item, after: Item) {
  const keys = new Set<string>()
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === 'id') continue
    const a = key === 'data' ? sharedData(before[key]) : before[key]
    const b = key === 'data' ? sharedData(after[key]) : after[key]
    if (!same(a, b)) keys.add(key)
  }
  return keys
}

/**
 * Brings the map from `base` to `items`: their changed fields written, those
 * left out removed. Without `base`, from what the map holds now.
 */
function syncItems(
  map: Shared,
  items: readonly (FlowNode | FlowEdge)[],
  base?: readonly (FlowNode | FlowEdge)[],
  /** Whether a new item can be added, e.g. an edge whose two nodes are there. */
  fits: (item: FlowNode | FlowEdge) => boolean = () => true,
) {
  if (!base) {
    const ids = new Set(items.map((item) => item.id))
    for (const id of Array.from(map.keys())) if (!ids.has(id)) map.delete(id)
    for (const item of items) write(map, item)
    return
  }
  const before = new Map(base.map((item) => [item.id, item]))
  const ids = new Set(items.map((item) => item.id))
  for (const id of before.keys()) if (!ids.has(id)) map.delete(id)
  for (const item of items) {
    const old = before.get(item.id)
    if (!old) {
      if (fits(item)) write(map, item)
      continue
    }
    // removed meanwhile by someone else: it stays removed
    if (!(map.get(item.id) instanceof Y.Map)) continue
    const keys = changedKeys(old as unknown as Item, item as unknown as Item)
    if (keys.size) write(map, item, keys)
  }
}

/** Warns about the first of `items` that is one of `kept` (from base) but no longer what the map holds: likely changed in place. */
function warnChangedItem(map: Shared, items: readonly (FlowNode | FlowEdge)[], kept: Set<object>) {
  for (const item of items) {
    const now = kept.has(item) ? read<Item>(map, item.id) : null
    if (!now || !changedKeys(now, item as unknown as Item).size) continue
    console.warn(
      `[@dou-ui/flow] updateMaps got "${item.id}" of \`base\` itself in \`doc\`, and it isn't what the map holds: a change made to it in place isn't written. Change a copy of \`base\`, e.g. structuredClone(base).`,
    )
    return true
  }
  return false
}

/** Warns when `doc` holds `base` itself, or nodes or edges of it changed in place. */
function warnChangedInPlace(maps: Maps, doc: FlowDocument, base: FlowDocument) {
  if (doc === base || doc.nodes === base.nodes) {
    console.warn(
      '[@dou-ui/flow] updateMaps got the same object as `doc` and `base`, so nothing is written: change a copy of `base`, e.g. structuredClone(base).',
    )
    return
  }
  if (!warnChangedItem(maps.nodes, doc.nodes, new Set(base.nodes)))
    warnChangedItem(maps.edges, doc.edges, new Set(base.edges))
}

export interface UpdateMapsOptions extends FillMapsOptions {
  /**
   * The version `doc` was made from, e.g. the one read with `readMaps` and
   * given to a program that took a while to write `doc`. Only the fields
   * that differ between `base` and `doc` are written, and only the nodes
   * and edges `base` has and `doc` hasn't are removed, so what others
   * changed meanwhile stays. Left out, the maps as they are now: then
   * every node and edge not in `doc` is removed.
   */
  base?: FlowDocument
}

/**
 * Change the maps from `options.base` to `doc`, without an editor, e.g. on
 * the server when a program wrote a new version while people edit the
 * flow. Only the fields that differ are written.
 */
export function updateMaps(maps: Maps, doc: FlowDocument, options: UpdateMapsOptions = {}) {
  const { base } = options
  if (process.env.NODE_ENV !== 'production' && base) warnChangedInPlace(maps, doc, base)
  const update = () => {
    syncItems(maps.nodes, doc.nodes, base?.nodes)
    // a new edge to a node someone removed meanwhile would lead nowhere
    const there = (end: { node: string }) => maps.nodes.get(end.node) instanceof Y.Map
    syncItems(maps.edges, doc.edges, base?.edges, (item) => {
      const edge = item as FlowEdge
      return there(edge.source) && there(edge.target)
    })
  }
  transact(maps, update, options.origin)
}

/** The fields `touched` holds for an item, when it holds only some. */
function heldKeys(touched: Touched, id: string) {
  const keys = touched.get(id)
  return keys === true ? undefined : keys
}

function mark(into: Touched, id: string, keys: string[] | true) {
  const current = into.get(id)
  if (current === true) return
  if (keys === true) return void into.set(id, true)
  const set = current ?? new Set<string>()
  for (const key of keys) set.add(key)
  into.set(id, set)
}

/** The nodes and edges a transaction added, removed or changed, with the fields it changed. */
function touch(steps: readonly FlowStep[], into: { nodes: Touched; edges: Touched }) {
  for (const step of steps) {
    if (step.type === 'addNode') mark(into.nodes, step.node.id, true)
    else if (step.type === 'removeNode') mark(into.nodes, step.id, true)
    else if (step.type === 'updateNode') mark(into.nodes, step.id, Object.keys(step.patch))
    else if (step.type === 'addEdge') mark(into.edges, step.edge.id, true)
    else if (step.type === 'removeEdge') mark(into.edges, step.id, true)
    else mark(into.edges, step.id, Object.keys(step.patch))
  }
}

/**
 * Edit a flow together through a Yjs document. Nodes and edges live in two
 * `Y.Map`s, each field on its own, so two people changing different fields
 * of one node both keep their change. The editor's `v-model` only mirrors
 * them: changes made to `v-model` from outside are not written back. While
 * someone drags, the others see an outline; the document changes once they
 * let go. Undo only takes back this user's own changes. Folding a group
 * stays local.
 */
export function collaboration(options: CollaborationOptions): FlowExtension {
  const { nodes, edges } = options
  const ydoc = nodes.doc
  if (!ydoc || edges.doc !== ydoc)
    throw new Error('[@dou-ui/flow] nodes and edges must be maps of the same Y.Doc')
  const { awareness, user } = options
  if (awareness && user) {
    const color = user.color ?? collaborationColors[ydoc.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }

  /** This editor's own changes, which undo can take back. */
  const tracked = { flow: 'tracked' }
  /** Changes that undo leaves alone, e.g. filling the maps or clearing dangling edges. */
  const untracked = { flow: 'untracked' }
  const undoManager = new Y.UndoManager([nodes, edges], {
    trackedOrigins: new Set([tracked]),
    captureTimeout: 500,
  })
  /** Set while shared changes are applied to the editor, so they aren't written back. */
  let applying = false
  /** What undo or redo is running, to name the change. */
  let travelling: 'undo' | 'redo' | null = null
  let lastGroup: string | undefined
  /** What changed during the current drag, written once it ends. */
  const held = { nodes: new Map() as Touched, edges: new Map() as Touched, tracking: false }

  function writeChanges(
    doc: FlowDocument,
    changed: { nodes: Touched; edges: Touched },
    tracking: boolean,
  ) {
    const nodeById = new Map(doc.nodes.map((node) => [node.id, node]))
    const edgeById = new Map(doc.edges.map((edge) => [edge.id, edge]))
    ydoc!.transact(
      () => {
        for (const [id, keys] of changed.nodes) {
          const node = nodeById.get(id)
          if (node) write(nodes, node, keys === true ? undefined : keys)
          else nodes.delete(id)
        }
        for (const [id, keys] of changed.edges) {
          const edge = edgeById.get(id)
          if (edge) write(edges, edge, keys === true ? undefined : keys)
          else edges.delete(id)
        }
      },
      tracking ? tracked : untracked,
    )
  }

  /** Writes what a drag changed, as one undo step. */
  function release(context: FlowEditorContext) {
    if (!held.nodes.size && !held.edges.size) return
    if (held.tracking) undoManager.stopCapturing()
    writeChanges(toRaw(context.doc.value), held, held.tracking)
    if (held.tracking) undoManager.stopCapturing()
    lastGroup = undefined
    held.nodes.clear()
    held.edges.clear()
    held.tracking = false
  }

  /**
   * Adds steps to `tr` that bring the given nodes and edges in line with the
   * maps; returns edges left without a node, to clear from the maps.
   */
  function pull(tr: FlowTransaction, nodeIds: Iterable<string>, edgeIds: Iterable<string>) {
    for (const id of nodeIds) {
      const shared = read<FlowNode>(nodes, id)
      const local = tr.getNode(id)
      // a node being dragged here keeps the fields the drag changes
      if (held.nodes.get(id) === true) continue
      if (!shared) {
        if (local) tr.removeNode(id)
      } else if (!local) tr.addNode(shared)
      else {
        const patch = patchFor(local, shared, heldKeys(held.nodes, id))
        if (patch) tr.updateNode(id, patch)
      }
    }
    for (const id of edgeIds) {
      const shared = read<FlowEdge>(edges, id)
      const local = tr.getEdge(id)
      if (held.edges.get(id) === true) continue
      if (!shared) {
        if (local) tr.removeEdge(id)
      } else if (!local) tr.addEdge(shared)
      else {
        const patch = patchFor(local, shared, heldKeys(held.edges, id))
        if (patch) tr.updateEdge(id, patch)
      }
    }
    // One person deleted a node while another connected to it: the edge goes too.
    const dangling: string[] = []
    for (const edge of tr.doc.edges)
      if (!tr.getNode(edge.source.node) || !tr.getNode(edge.target.node)) dangling.push(edge.id)
    for (const id of dangling) tr.removeEdge(id)
    return dangling
  }

  return defineFlowExtension({
    name: 'collaboration',
    // after the other extensions, so it writes what they added
    priority: 0,
    transaction(tr, context) {
      if (applying) return
      const tracking = tr.meta.history !== false
      if (context.gesturing.value) {
        touch(tr.steps, held)
        held.tracking ||= tracking
        return
      }
      const changed = { nodes: new Map() as Touched, edges: new Map() as Touched }
      touch(tr.steps, changed)
      // like the editor's own history: only changes in one group undo together
      if (tracking && (!tr.meta.group || tr.meta.group !== lastGroup)) undoManager.stopCapturing()
      if (tracking) lastGroup = tr.meta.group
      writeChanges(tr.doc, changed, tracking)
    },
    history: () => ({
      undo: () => run('undo'),
      redo: () => run('redo'),
      canUndo: () => undoManager.undoStack.length > 0,
      canRedo: () => undoManager.redoStack.length > 0,
    }),
    layers: awareness ? { above: [createPeers(awareness)] } : undefined,
    setup(context) {
      const apply = (fn: (tr: FlowTransaction) => string[], origin: string) => {
        let dangling: string[] = []
        applying = true
        try {
          context.transact((tr) => (dangling = fn(tr)), { history: false, origin })
        } finally {
          applying = false
        }
        if (dangling.length)
          queueMicrotask(() =>
            ydoc.transact(() => {
              for (const id of dangling) edges.delete(id)
            }, untracked),
          )
      }
      const current = () => toRaw(context.doc.value)

      // the first one to open the flow brings its nodes; everyone else reads the maps
      if (!nodes.size && !edges.size)
        ydoc.transact(() => fillMaps({ nodes, edges }, current()), untracked)
      const doc = current()
      apply(
        (tr) =>
          pull(
            tr,
            new Set([...doc.nodes.map((node) => node.id), ...nodes.keys()]),
            new Set([...doc.edges.map((edge) => edge.id), ...edges.keys()]),
          ),
        'remote',
      )

      // changes from others, and from undo: gathered per Yjs transaction
      const pending = { nodes: new Set<string>(), edges: new Set<string>() }
      const gather =
        (map: Shared, into: Set<string>) =>
        (events: Y.YEvent<Y.Map<unknown>>[], transaction: Y.Transaction) => {
          if (transaction.origin === tracked || transaction.origin === untracked) return
          for (const event of events) {
            if (event.target === map) for (const key of event.changes.keys.keys()) into.add(key)
            else if (event.path.length) into.add(String(event.path[0]))
          }
        }
      const onNodes = gather(nodes, pending.nodes)
      const onEdges = gather(edges, pending.edges)
      const flush = () => {
        if (!pending.nodes.size && !pending.edges.size) return
        const nodeIds = [...pending.nodes]
        const edgeIds = [...pending.edges]
        pending.nodes.clear()
        pending.edges.clear()
        apply((tr) => pull(tr, nodeIds, edgeIds), travelling ?? 'remote')
      }
      nodes.observeDeep(onNodes)
      edges.observeDeep(onEdges)
      ydoc.on('afterTransaction', flush)

      // a drag is written once it ends, cancelled or not
      const stopRelease = watch(context.gesturing, (on) => !on && release(context), {
        flush: 'sync',
      })

      let stopPresence: (() => void) | undefined
      if (awareness) {
        // what this user is dragging, connecting and has selected, for the others to see
        stopPresence = watch(
          [context.gesturing, context.doc, context.selection, context.connectingPath],
          ([on, , selection, path]) => {
            const moving: FlowPresence['moving'] = []
            if (on)
              for (const id of held.nodes.keys()) {
                if (moving.length >= 100) break
                const rect = context.getNodeRect(id)
                if (rect) moving.push({ id, ...rect })
              }
            awareness.setLocalStateField('flow', {
              moving,
              selection: {
                nodes: selection.nodes.slice(0, 100),
                edges: selection.edges.slice(0, 100),
              },
              path,
            } satisfies FlowPresence)
          },
          { immediate: true },
        )
      }

      return () => {
        nodes.unobserveDeep(onNodes)
        edges.unobserveDeep(onEdges)
        ydoc.off('afterTransaction', flush)
        stopRelease()
        stopPresence?.()
        awareness?.setLocalStateField('flow', null)
      }
    },
  })

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
}

export type { AwarenessLike, FlowPresence }
