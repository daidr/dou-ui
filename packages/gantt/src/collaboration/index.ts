import { toRaw, watch } from 'vue'
import * as Y from 'yjs'
import { defineGanttExtension, type GanttExtension } from '../core/extension'
import type { GanttLink, GanttTask } from '../core/model'
import { isOrderKey, orderKeys } from '../core/order'
import type { GanttDocument, GanttStep, GanttTransaction } from '../core/transaction'
import { buildTree } from '../core/tree'
import { createPeers, type AwarenessLike, type GanttPresence } from './peers'

/** How the people editing together see each other. */
export interface CollaborationUser {
  name: string
  /** The color of this user's outlines, any CSS color. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the tasks live, e.g. `ydoc.getMap('tasks')`. */
  tasks: Y.Map<unknown>
  /** Where the links live, e.g. `ydoc.getMap('links')`; in the same `Y.Doc` as `tasks`. */
  links: Y.Map<unknown>
  /** Shares what each person selects and drags (`y-protocols/awareness`). */
  awareness?: AwarenessLike
  /** This user, shown to the others. Needs `awareness`. */
  user?: CollaborationUser
}

/** Deep, low-saturation colors that read on both light and dark surfaces. */
export const collaborationColors = [
  '#3b6ea8',
  '#a8553b',
  '#3b8a6e',
  '#8a3b7a',
  '#8a7a3b',
  '#5b4fa8',
  '#3b8a8a',
  '#a83b55',
]

type Shared = Y.Map<unknown>
type Item = Record<string, unknown>

/** Folding is each person's own view: it stays out of the shared document. */
const LOCAL_FIELDS = new Set(['id', 'collapsed'])

const same = (a: unknown, b: unknown) =>
  a === b || (typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b))

/** A task or link as the map holds it, or `null` when it holds none. */
function read<T>(map: Shared, id: string): T | null {
  const fields = map.get(id)
  if (!(fields instanceof Y.Map)) return null
  return { ...(fields.toJSON() as Item), id } as T
}

/** Writes a task's or link's fields, only those that changed. */
function write(map: Shared, value: GanttTask | GanttLink) {
  const item = value as unknown as Item
  const existing = map.get(value.id)
  const fields: Shared = existing instanceof Y.Map ? existing : new Y.Map<unknown>()
  for (const [key, field] of Object.entries(item)) {
    if (LOCAL_FIELDS.has(key) || field === undefined) continue
    if (!same(fields.get(key), field)) fields.set(key, field)
  }
  if (existing !== fields) return void map.set(value.id, fields)
  for (const key of Array.from(fields.keys()))
    if (!LOCAL_FIELDS.has(key) && item[key] === undefined) fields.delete(key)
}

/** The change that makes `local` match `shared`, keeping the local fields. */
function patchFor<T extends object>(local: T, shared: T) {
  const a = local as Item
  const b = shared as Item
  const patch: Item = {}
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (LOCAL_FIELDS.has(key)) continue
    if (!same(a[key], b[key])) patch[key] = b[key]
  }
  return Object.keys(patch).length ? (patch as Partial<T>) : null
}

/**
 * Gives every task an `order` key, so that siblings sort alike for
 * everyone. Siblings whose keys are already in order keep them.
 */
function withOrder(tasks: GanttTask[]): GanttTask[] {
  const tree = buildTree(tasks)
  const keys = new Map<string, string>()
  for (const siblings of tree.childrenOf.values()) {
    const ordered = siblings.every(
      (task, i) =>
        task.order != null &&
        isOrderKey(task.order) &&
        (i === 0 || siblings[i - 1]!.order! < task.order),
    )
    if (ordered) continue
    const fresh = orderKeys(siblings.length)
    siblings.forEach((task, i) => keys.set(task.id, fresh[i]!))
  }
  return keys.size
    ? tasks.map((task) => (keys.has(task.id) ? { ...task, order: keys.get(task.id) } : task))
    : tasks
}

/**
 * Writes tasks and links into empty maps, e.g. when a plan that so far was
 * saved as JSON starts being edited together. Every task gets an `order`
 * key. Do it once, where the shared document is created.
 */
export function fillMaps(
  maps: { tasks: Y.Map<unknown>; links: Y.Map<unknown> },
  doc: GanttDocument,
) {
  const fill = () => {
    for (const task of withOrder(doc.tasks)) write(maps.tasks, task)
    for (const link of doc.links) write(maps.links, link)
  }
  const ydoc = maps.tasks.doc
  if (ydoc) ydoc.transact(fill)
  else fill()
}

/** The tasks and links a transaction added, removed or changed. */
function touched(steps: readonly GanttStep[]) {
  const tasks = new Set<string>()
  const links = new Set<string>()
  for (const step of steps) {
    if (step.type === 'addTask') tasks.add(step.task.id)
    else if (step.type === 'addLink') links.add(step.link.id)
    else if (step.type === 'removeTask' || step.type === 'updateTask') tasks.add(step.id)
    else links.add(step.id)
  }
  return { tasks, links }
}

/** Gives the tasks a transaction added without an `order` key one, where they sort now. */
function orderAdded(tr: GanttTransaction) {
  for (const step of tr.steps.slice()) {
    if (step.type !== 'addTask') continue
    const task = tr.getTask(step.task.id)
    if (!task || task.order != null) continue
    const parent = task.parent != null && tr.getTask(task.parent) ? task.parent : undefined
    const siblings = buildTree(tr.doc.tasks).childrenOf.get(parent) ?? []
    tr.moveTask(
      task.id,
      parent,
      siblings.findIndex((item) => item.id === task.id),
    )
  }
}

/**
 * Edit a Gantt chart together through a Yjs document. The tasks and links
 * live in two `Y.Map`s: the chart's `v-model` only mirrors them, and
 * changes made to `v-model` from outside are not written back. Undo only
 * takes back this user's own changes. Folding a summary stays local.
 */
export function collaboration(options: CollaborationOptions): GanttExtension {
  const { tasks, links } = options
  const ydoc = tasks.doc
  if (!ydoc || links.doc !== ydoc)
    throw new Error('[@dou-ui/gantt] tasks and links must be maps of the same Y.Doc')
  const { awareness, user } = options
  if (awareness && user) {
    const color = user.color ?? collaborationColors[ydoc.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }

  /** This chart's own changes, which undo can take back. */
  const tracked = { gantt: 'tracked' }
  /** Changes that undo leaves alone, e.g. filling the maps. */
  const untracked = { gantt: 'untracked' }
  const undoManager = new Y.UndoManager([tasks, links], {
    trackedOrigins: new Set([tracked]),
    captureTimeout: 500,
  })
  /** Set while shared changes are applied to the chart, so they aren't written back. */
  let applying = false
  /** What undo or redo is running, to name the change. */
  let travelling: 'undo' | 'redo' | null = null
  let lastGroup: string | undefined

  function writeChanges(tr: GanttTransaction) {
    const { tasks: taskIds, links: linkIds } = touched(tr.steps)
    const taskById = new Map(tr.doc.tasks.map((task) => [task.id, task]))
    const linkById = new Map(tr.doc.links.map((link) => [link.id, link]))
    const tracking = tr.meta.history !== false
    // like the chart's own history: only changes in one group undo together
    if (tracking && (!tr.meta.group || tr.meta.group !== lastGroup)) undoManager.stopCapturing()
    if (tracking) lastGroup = tr.meta.group
    ydoc!.transact(
      () => {
        for (const id of taskIds) {
          const task = taskById.get(id)
          if (task) write(tasks, task)
          else tasks.delete(id)
        }
        for (const id of linkIds) {
          const link = linkById.get(id)
          if (link) write(links, link)
          else links.delete(id)
        }
      },
      tracking ? tracked : untracked,
    )
  }

  /** Adds steps to `tr` that bring the given tasks and links in line with the maps. */
  function pull(tr: GanttTransaction, taskIds: Iterable<string>, linkIds: Iterable<string>) {
    for (const id of taskIds) {
      const shared = read<GanttTask>(tasks, id)
      const local = tr.getTask(id)
      if (!shared) {
        if (local) tr.step({ type: 'removeTask', id })
      } else if (!local) tr.step({ type: 'addTask', task: shared })
      else {
        const patch = patchFor(local, shared)
        if (patch) tr.step({ type: 'updateTask', id, patch })
      }
    }
    for (const id of linkIds) {
      const shared = read<GanttLink>(links, id)
      const local = tr.getLink(id)
      if (!shared) {
        if (local) tr.step({ type: 'removeLink', id })
      } else if (!local) tr.step({ type: 'addLink', link: shared })
      else {
        const patch = patchFor(local, shared)
        if (patch) tr.step({ type: 'updateLink', id, patch })
      }
    }
  }

  return defineGanttExtension({
    name: 'collaboration',
    // after the other extensions, so it writes what they added
    priority: 0,
    transaction(tr) {
      if (applying) return
      orderAdded(tr)
      writeChanges(tr)
    },
    history: () => ({
      undo: () => run('undo'),
      redo: () => run('redo'),
      canUndo: () => undoManager.undoStack.length > 0,
      canRedo: () => undoManager.redoStack.length > 0,
    }),
    layers: awareness ? { above: [createPeers(awareness)] } : undefined,
    setup(context) {
      const apply = (fn: (tr: GanttTransaction) => void, origin: string) => {
        applying = true
        try {
          context.transact(fn, { history: false, schedule: false, origin })
        } finally {
          applying = false
        }
      }
      const current = () => ({
        tasks: toRaw(context.tasks.value),
        links: toRaw(context.links.value),
      })

      // the first one to open the plan brings its tasks; everyone else reads the maps
      if (!tasks.size && !links.size)
        ydoc.transact(() => fillMaps({ tasks, links }, current()), untracked)
      const doc = current()
      apply(
        (tr) =>
          pull(
            tr,
            new Set([...doc.tasks.map((task) => task.id), ...tasks.keys()]),
            new Set([...doc.links.map((link) => link.id), ...links.keys()]),
          ),
        'remote',
      )

      // changes from others, and from undo: gathered per Yjs transaction
      const pending = { tasks: new Set<string>(), links: new Set<string>() }
      const gather =
        (map: Shared, into: Set<string>) =>
        (events: Y.YEvent<Y.Map<unknown>>[], transaction: Y.Transaction) => {
          if (transaction.origin === tracked || transaction.origin === untracked) return
          for (const event of events) {
            if (event.target === map) for (const key of event.changes.keys.keys()) into.add(key)
            else if (event.path.length) into.add(String(event.path[0]))
          }
        }
      const onTasks = gather(tasks, pending.tasks)
      const onLinks = gather(links, pending.links)
      const flush = () => {
        if (!pending.tasks.size && !pending.links.size) return
        const taskIds = [...pending.tasks]
        const linkIds = [...pending.links]
        pending.tasks.clear()
        pending.links.clear()
        apply((tr) => pull(tr, taskIds, linkIds), travelling ?? 'remote')
      }
      tasks.observeDeep(onTasks)
      links.observeDeep(onLinks)
      ydoc.on('afterTransaction', flush)

      let stopPresence: (() => void) | undefined
      if (awareness) {
        // what this user is dragging and has selected, for the others to see
        stopPresence = watch(
          [context.preview, context.selection],
          ([preview, selection]) => {
            const moving: GanttPresence['moving'] = []
            for (const [id, patch] of preview ?? []) {
              if (moving.length >= 100) break
              moving.push({ id, start: patch.start, end: patch.end })
            }
            awareness.setLocalStateField('gantt', {
              moving,
              selection: selection.slice(0, 100),
            } satisfies GanttPresence)
          },
          { immediate: true },
        )
      }

      return () => {
        tasks.unobserveDeep(onTasks)
        links.unobserveDeep(onLinks)
        ydoc.off('afterTransaction', flush)
        stopPresence?.()
        awareness?.setLocalStateField('gantt', null)
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

export type { AwarenessLike, GanttPresence }
