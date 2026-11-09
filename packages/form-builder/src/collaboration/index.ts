import { collaborationColors } from 'dou-ui'
import { computed, shallowRef, watch } from 'vue'
import * as Y from 'yjs'
import { isContainer, walkNodes } from '../core/document'
import type { FormContainerNode, FormDocument, FormNode } from '../core/types'
import type { FormBuilderContext } from '../builder/context'
import { replaceDocument } from '../builder/core/commands'
import { canContainFormNode, formNodePlaces } from '../builder/core/transaction'
import type { FormBuilderTransaction } from '../builder/core/transaction'
import { defineFormBuilderExtension } from '../builder/extension'
import type { FormBuilderExtension, FormBuilderNodeMark } from '../builder/extension'
import { orderKeys } from './order'

/** The part of an `Awareness` (`y-protocols/awareness`) the builder uses. */
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
  /** The color of this user's marks, any CSS color. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the nodes live, e.g. `ydoc.getMap('nodes')`. */
  nodes: Y.Map<unknown>
  /** Where the form's own settings live, e.g. `ydoc.getMap('settings')`; in the same `Y.Doc` as `nodes`. */
  settings: Y.Map<unknown>
  /** Shares what each person has selected (`y-protocols/awareness`). */
  awareness?: AwarenessLike
  /** This user, shown to the others. Needs `awareness`. */
  user?: CollaborationUser
}

/** What each person shares under the awareness field `formBuilder`. */
export interface FormBuilderPresence {
  selection: string[]
}

export { collaborationColors }

type Shared = Y.Map<unknown>
type Item = Record<string, unknown>

/** The container a node is in (`null`: the top of the form) and its place there, kept beside its keys. */
const PARENT = '$parent'
const ORDER = '$order'

const same = (a: unknown, b: unknown) =>
  a === b ||
  (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b))

/** Where in `value` something JSON can't carry sits, e.g. a component or a function. */
function unshareable(value: unknown, path: string): string | null {
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value))
    return null
  if (typeof value !== 'object') return path
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = unshareable(item, `${path}[${i}]`)
      if (found) return found
    }
    return null
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return path
  for (const [key, item] of Object.entries(value)) {
    const found = unshareable(item, `${path}.${key}`)
    if (found) return found
  }
  return null
}

const warned = new Set<string>()
/** Others would get a broken copy of such a value while this builder shows it fine. */
function warnUnshareable(id: string, key: string, value: unknown) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production') return
  const path = unshareable(value, key)
  if (!path || warned.has(`${id}:${path}`)) return
  warned.add(`${id}:${path}`)
  console.warn(
    `[@dou-ui/form-builder] "${id}" has ${path}, which can't be shared: only JSON values reach the others. Store a name and look the component or function up where it is used.`,
  )
}

/** Writes a node's keys besides its place, only those that changed; `keys` limits which. */
function writeNode(map: Shared, node: FormNode, keys?: Set<string>) {
  const existing = map.get(node.id)
  const fields: Shared = existing instanceof Y.Map ? existing : new Y.Map<unknown>()
  const fresh = existing !== fields
  const item = node as unknown as Item
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || key === 'children' || value === undefined) continue
    if (keys && !fresh && !keys.has(key)) continue
    warnUnshareable(node.id, key, value)
    // a new map can't be read before it is in the document
    if (fresh || !same(fields.get(key), value)) fields.set(key, value)
  }
  if (fresh) return void map.set(node.id, fields)
  for (const key of Array.from(fields.keys()))
    if (key[0] !== '$' && item[key] === undefined && (!keys || keys.has(key))) fields.delete(key)
}

/** Writes the place of each child of a container, giving new order keys only where it must. */
function writeOrder(map: Shared, parent: string | null, children: readonly FormNode[]) {
  const shared = children.map((child) => {
    const fields = map.get(child.id)
    return fields instanceof Y.Map ? fields : null
  })
  const current = shared.map((fields) =>
    fields && (fields.get(PARENT) ?? null) === parent
      ? ((fields.get(ORDER) as string | undefined) ?? null)
      : null,
  )
  const keys = orderKeys(current)
  shared.forEach((fields, index) => {
    if (!fields) return
    if ((fields.get(PARENT) ?? null) !== parent) fields.set(PARENT, parent)
    if (fields.get(ORDER) !== keys[index]) fields.set(ORDER, keys[index])
  })
}

export interface FillMapsOptions {
  /** The origin of the Yjs transaction, so the others can tell who wrote it. */
  origin?: unknown
}

/** Writes a form into empty maps, e.g. when a form so far saved as JSON starts being edited together. */
export function fillMaps(
  maps: { nodes: Y.Map<unknown>; settings: Y.Map<unknown> },
  document: FormDocument,
  options: FillMapsOptions = {},
) {
  const fill = () => {
    for (const node of walkNodes(document.nodes)) writeNode(maps.nodes, node)
    writeOrder(maps.nodes, null, document.nodes)
    for (const node of walkNodes(document.nodes))
      if (isContainer(node)) writeOrder(maps.nodes, node.id, node.children)
    for (const [key, value] of Object.entries(document))
      if (key !== 'nodes' && key !== 'version' && value !== undefined) maps.settings.set(key, value)
  }
  const ydoc = maps.nodes.doc
  if (ydoc) ydoc.transact(fill, options.origin ?? null)
  else fill()
}

interface Entry {
  node: FormNode
  parent: string | null
  order: string
}

/**
 * The form the maps hold. A node whose container is gone, e.g. one moved
 * into a section while another person deleted the section, goes to the top
 * of the form. So do containers two people moved into each other at once:
 * the one with the smallest id goes to the top, the same for everyone.
 * Both are listed in `lifted`.
 */
export function readMaps(maps: { nodes: Y.Map<unknown>; settings: Y.Map<unknown> }): {
  document: FormDocument
  lifted: string[]
} {
  const entries = new Map<string, Entry>()
  maps.nodes.forEach((value, id) => {
    if (!(value instanceof Y.Map)) return
    const { [PARENT]: parent, [ORDER]: order, ...rest } = value.toJSON() as Item
    entries.set(id, {
      node: { ...rest, id } as unknown as FormNode,
      parent: typeof parent === 'string' ? parent : null,
      order: typeof order === 'string' ? order : '',
    })
  })

  const lifted: string[] = []
  const reached = new Set<string>()
  // Walk up from each node until the top or a node already reached.
  const reach = (id: string) => {
    const path: string[] = []
    let current: string | null = id
    while (current !== null && !reached.has(current)) {
      const entry: Entry = entries.get(current)!
      const loop = path.indexOf(current)
      if (loop >= 0) {
        // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
        const top = path.slice(loop).sort()[0]!
        entries.get(top)!.parent = null
        lifted.push(top)
        return reach(id)
      }
      path.push(current)
      if (entry.parent !== null && !entries.has(entry.parent)) {
        entry.parent = null
        lifted.push(current)
      }
      current = entry.parent
    }
    for (const each of path) reached.add(each)
  }
  for (const id of entries.keys()) if (!reached.has(id)) reach(id)

  const byParent = new Map<string | null, Entry[]>()
  for (const entry of entries.values()) {
    const list = byParent.get(entry.parent)
    if (list) list.push(entry)
    else byParent.set(entry.parent, [entry])
  }
  const build = (parent: FormNode | null): FormNode[] => {
    const list = byParent.get(parent?.id ?? null) ?? []
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the list built here
    list.sort((a, b) =>
      a.order < b.order ? -1 : a.order > b.order ? 1 : a.node.id < b.node.id ? -1 : 1,
    )
    const nodes: FormNode[] = []
    for (const { node } of list) {
      // A node that can't be here, e.g. a field among pages, waits until it can.
      if (!canContainFormNode(parent, node)) continue
      nodes.push(
        isContainer(node)
          ? ({ ...node, children: build(node) } as FormContainerNode)
          : (node as FormNode),
      )
    }
    return nodes
  }
  const settings = maps.settings.toJSON() as Item
  delete settings.nodes
  delete settings.version
  return {
    document: { ...settings, version: 1, nodes: build(null) } as FormDocument,
    lifted,
  }
}

/** The nodes, places and settings a transaction changed, written to the maps. */
function writeChanges(maps: { nodes: Shared; settings: Shared }, tr: FormBuilderTransaction) {
  const after = formNodePlaces(tr.doc)
  const touched = new Map<string, Set<string> | true>()
  const parents = new Set<string | null>()
  const settings = new Set<string>()
  let removed = false
  const mark = (id: string, keys: string[] | true) => {
    const current = touched.get(id)
    if (current === true) return
    if (keys === true) return void touched.set(id, true)
    const set = current ?? new Set<string>()
    for (const key of keys) set.add(key)
    touched.set(id, set)
  }
  for (const step of tr.steps) {
    if (step.type === 'insert') {
      parents.add(step.parent)
      for (const node of walkNodes([step.node])) {
        mark(node.id, true)
        if (isContainer(node)) parents.add(node.id)
      }
    } else if (step.type === 'remove') removed = true
    else if (step.type === 'update') mark(step.id, Object.keys(step.patch))
    else if (step.type === 'move') parents.add(step.parent)
    else for (const key of Object.keys(step.patch)) settings.add(key)
  }

  if (removed)
    for (const id of formNodePlaces(tr.before).keys()) if (!after.has(id)) maps.nodes.delete(id)
  for (const [id, keys] of touched) {
    const node = after.get(id)?.node
    if (node) writeNode(maps.nodes, node, keys === true ? undefined : keys)
  }
  for (const parent of parents) {
    if (parent === null) writeOrder(maps.nodes, null, tr.doc.nodes)
    else {
      const node = after.get(parent)?.node
      if (node && isContainer(node)) writeOrder(maps.nodes, parent, node.children)
    }
  }
  const document = tr.doc as unknown as Item
  for (const key of settings) {
    const value = document[key]
    if (value === undefined) maps.settings.delete(key)
    else if (!same(maps.settings.get(key), value)) maps.settings.set(key, value)
  }
}

interface Peer {
  client: number
  name: string
  color: string
  selection: string[]
}

/**
 * Edit a form together through a Yjs document. Each node lives in `nodes`
 * as its own `Y.Map`, each key on its own, with its container and an order
 * key beside them; so two people changing different keys of one field both
 * keep their change, and moving a node only writes that node. The form's
 * settings live in `settings`. The builder's `v-model` only mirrors them:
 * a form set through `v-model` from outside is not written back. Undo only
 * takes back this user's own changes. With `awareness`, each person sees
 * what the others have selected, marked in their colors.
 */
export function collaboration(options: CollaborationOptions): FormBuilderExtension {
  const { nodes, settings, awareness, user } = options
  const ydoc = nodes.doc
  if (!ydoc || settings.doc !== ydoc)
    throw new Error('[@dou-ui/form-builder] nodes and settings must be maps of the same Y.Doc')
  if (awareness && user) {
    const color = user.color ?? collaborationColors[ydoc.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }
  const maps = { nodes, settings }

  /** This builder's own changes, which undo can take back. */
  const tracked = { formBuilder: 'tracked' }
  /** Changes undo leaves alone, e.g. filling the maps or lifting nodes out of deleted containers. */
  const untracked = { formBuilder: 'untracked' }
  const undoManager = new Y.UndoManager([nodes, settings], {
    trackedOrigins: new Set([tracked]),
    captureTimeout: 500,
  })
  let context: FormBuilderContext | undefined
  /** Set while shared changes are applied to the builder, so they aren't written back. */
  let applying = false
  /** What undo or redo is running, to name the change. */
  let travelling: 'undo' | 'redo' | null = null
  /** The selection to go back to once undo or redo has run. */
  let restore: string[] | undefined
  let lastGroup: string | undefined

  // Each step of undo keeps the selection from before it, and each step of redo the one after.
  undoManager.on('stack-item-added', (event: { stackItem: { meta: Map<string, unknown> } }) => {
    event.stackItem.meta.set('selection', context?.selection.slice() ?? [])
  })
  undoManager.on('stack-item-popped', (event: { stackItem: { meta: Map<string, unknown> } }) => {
    restore = event.stackItem.meta.get('selection') as string[] | undefined
  })

  /** Brings the builder in line with the maps. */
  function pull() {
    if (!context) return
    const { document, lifted } = readMaps(maps)
    const tr = context.transaction()
    try {
      replaceDocument(tr, document)
    } catch (error) {
      console.error('[@dou-ui/form-builder] could not apply a shared change', error)
      return
    }
    if (tr.changed) {
      tr.setMeta('history', false)
      tr.setMeta('origin', travelling ?? 'remote')
      applying = true
      try {
        context.dispatch(tr)
      } finally {
        applying = false
      }
    }
    // Everyone works these out alike; writing them keeps the maps tidy.
    if (lifted.length)
      queueMicrotask(() =>
        ydoc!.transact(() => {
          for (const id of lifted) {
            const fields = nodes.get(id)
            if (fields instanceof Y.Map && fields.get(PARENT) !== null) fields.set(PARENT, null)
          }
        }, untracked),
      )
  }

  function run(action: 'undo' | 'redo') {
    const stack = action === 'undo' ? undoManager.undoStack : undoManager.redoStack
    if (!stack.length) return false
    travelling = action
    restore = undefined
    try {
      undoManager[action]()
    } finally {
      travelling = null
    }
    if (restore && context) context.select(restore)
    restore = undefined
    return true
  }

  const peers = shallowRef<Peer[]>([])
  /** The others who have each node selected. */
  const marksByNode = computed(() => {
    const map = new Map<string, FormBuilderNodeMark[]>()
    for (const peer of peers.value)
      for (const id of peer.selection) {
        const mark = {
          key: `peer-${peer.client}`,
          label: peer.name,
          color: peer.color,
        }
        const list = map.get(id)
        if (list) list.push(mark)
        else map.set(id, [mark])
      }
    return map
  })

  return defineFormBuilderExtension({
    name: 'collaboration',
    // after the other extensions, so it writes what they added
    priority: 0,
    transaction(tr) {
      if (applying) return
      const tracking = tr.meta.history !== false
      // like the builder's own history: only changes of one group undo together
      if (tracking && (!tr.meta.group || tr.meta.group !== lastGroup)) undoManager.stopCapturing()
      if (tracking) lastGroup = tr.meta.group
      ydoc.transact(() => writeChanges(maps, tr), tracking ? tracked : untracked)
    },
    history: () => ({
      undo: () => run('undo'),
      redo: () => run('redo'),
      canUndo: () => undoManager.undoStack.length > 0,
      canRedo: () => undoManager.redoStack.length > 0,
    }),
    marks: awareness ? (_context, node) => marksByNode.value.get(node.id) ?? [] : undefined,
    setup(builder) {
      context = builder
      // the first one to open the form brings its nodes; everyone else reads the maps
      if (!nodes.size && !settings.size)
        ydoc.transact(() => fillMaps(maps, builder.document), untracked)
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
      nodes.observeDeep(observe)
      settings.observeDeep(observe)
      ydoc.on('afterTransaction', flush)

      let stopPresence: (() => void) | undefined
      let readPeers: (() => void) | undefined
      if (awareness) {
        readPeers = () => {
          const list: Peer[] = []
          awareness.getStates().forEach((state, client) => {
            if (client === awareness.clientID) return
            const who = state.user as { name?: string; color?: string } | undefined
            const presence = state.formBuilder as FormBuilderPresence | null | undefined
            if (!who || !presence?.selection?.length) return
            list.push({
              client,
              name: who.name ?? '',
              color: who.color ?? 'currentColor',
              selection: presence.selection,
            })
          })
          peers.value = list
        }
        readPeers()
        awareness.on('change', readPeers)
        stopPresence = watch(
          () => builder.selection,
          (selection) =>
            awareness.setLocalStateField('formBuilder', {
              selection: selection.slice(0, 100),
            } satisfies FormBuilderPresence),
          { immediate: true },
        )
      }

      return () => {
        nodes.unobserveDeep(observe)
        settings.unobserveDeep(observe)
        ydoc.off('afterTransaction', flush)
        stopPresence?.()
        if (readPeers) awareness?.off('change', readPeers)
        awareness?.setLocalStateField('formBuilder', null)
        context = undefined
      }
    },
  })
}
