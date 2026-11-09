import { MessagePlusIcon } from '@dou-ui/icons'
import {
  applyCommentAction,
  type CommentAction,
  type CommentAuthor,
  type CommentThread,
  type ContextMenuItem,
} from 'dou-ui'
import { computed, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import type { FlowCommentAnchor, FlowEditorEmits, FlowEditorProps } from './context'
import { defineFlowExtension, type FlowExtension } from './core/extension'
import type { FlowToolbarItem } from './core/menu'
import type { FlowDocument, FlowNode, FlowSelection, Point } from './core/model'
import type { FlowTransaction, FlowTransactionMeta } from './core/transaction'
import type { FlowMessages } from './locale'

type Emit = <K extends keyof FlowEditorEmits>(event: K, ...args: FlowEditorEmits[K]) => void

/** The comments, as the editor's parts see them. */
export interface FlowComments {
  enabled: ComputedRef<boolean>
  /** Threads can be started and replied to. */
  writable: ComputedRef<boolean>
  threads: ComputedRef<readonly CommentThread[]>
  author: ComputedRef<CommentAuthor | undefined>
  /** The thread open now. */
  active: ComputedRef<string | null>
  /** What a thread being started is about, until its first comment is sent. */
  pending: ShallowRef<FlowCommentAnchor | null>
  /** Goes up when the open thread should take the focus, ready for a reply. */
  focusRequest: ShallowRef<number>
  /**
   * The open threads on each node and edge, oldest first; a node's leave
   * out those pinned to a point on it, which are in `pins`.
   */
  openOn: ComputedRef<{
    nodes: Map<string, string[]>
    edges: Map<string, string[]>
    pins: FlowCommentPin[]
  }>
  start: (anchor?: FlowCommentAnchor | null, focus?: boolean) => boolean
  /** Opens a thread, with the focus in its reply box when `focus`. */
  show: (id: string, focus: boolean) => void
  apply: (action: CommentAction) => void
  open: (id: string | null) => void
  close: () => void
  /** Whether this editor opened the thread `id`, rather than the app. */
  openedHere: (id: string | null) => boolean
}

/** An open thread pinned to a point on a node. */
export interface FlowCommentPin {
  thread: string
  node: string
  at: Point
  /** Its number on the node: its place among the node's pins, from 1, oldest first, resolved ones counted. */
  number: number
}

type MarkPatch = { comments: string[] | undefined; commentPins?: Record<string, Point> | undefined }

const KEY = 'mod+alt+m'

const fraction = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null

/** A point within a node, kept between 0 and 1; `null` when it isn't one. */
export function pinPoint(at: unknown): Point | null {
  if (!at || typeof at !== 'object') return null
  const x = fraction((at as Point).x)
  const y = fraction((at as Point).y)
  return x === null || y === null ? null : { x, y }
}

/** Where the thread `id` is pinned on a node, if it is. */
const pinOf = (node: FlowNode, id: string): Point | null => {
  const pins = node.commentPins
  return pins && typeof pins === 'object' && Object.hasOwn(pins, id) ? pinPoint(pins[id]) : null
}

/** The thread ids on a node or edge; nothing when a hand-written document has something else there. */
const idsOf = (item: { comments?: unknown }): string[] =>
  Array.isArray(item.comments) ? item.comments.filter((id) => typeof id === 'string') : []

export function useFlowComments(options: {
  props: FlowEditorProps
  emit: Emit
  doc: ComputedRef<FlowDocument>
  selection: Ref<FlowSelection>
  messages: ComputedRef<FlowMessages>
  transact: (fn: (tr: FlowTransaction) => void, meta?: FlowTransactionMeta) => FlowTransaction
  /** Keeps a change kept out of undo on a node or edge as undo and redo bring it back. */
  carry: (anchor: FlowCommentAnchor, patch: MarkPatch) => void
  /** The open threads a node's marker counts: a collapsed container's take in those inside it. */
  shownOn: (anchor: FlowCommentAnchor) => string[] | undefined
}) {
  const { props, emit, doc, selection, messages, transact, carry, shownOn } = options

  const threads = computed<readonly CommentThread[]>(() => props.comments ?? [])
  const enabled = computed(() => props.comments !== undefined)
  const writable = computed(() => enabled.value && !!props.author && props.commentable !== false)

  const innerActive = shallowRef<string | null>(null)
  const active = computed(() =>
    props.activeComment === undefined ? innerActive.value : props.activeComment,
  )
  /** The last thread this editor opened, so a `v-model:activeComment` echoing it isn't taken for one from outside. */
  let ownOpen: string | null = null
  function open(id: string | null) {
    if (id === active.value) return
    innerActive.value = id
    ownOpen = id
    emit('update:activeComment', id)
  }
  const openedHere = (id: string | null) => id === ownOpen

  const pending = shallowRef<FlowCommentAnchor | null>(null)
  const focusRequest = shallowRef(0)

  const openOn = computed(() => {
    const live = new Set(threads.value.filter((t) => !t.resolved).map((t) => t.id))
    const known = new Set(threads.value.map((t) => t.id))
    const pins: FlowCommentPin[] = []
    const nodes = new Map<string, string[]>()
    for (const node of doc.value.nodes) {
      const ids: string[] = []
      let number = 0
      for (const id of idsOf(node)) {
        const at = pinOf(node, id)
        // numbered among every pin there, so resolving one renumbers none
        if (at && known.has(id)) number++
        if (!live.has(id)) continue
        if (at) pins.push({ thread: id, node: node.id, at, number })
        else ids.push(id)
      }
      if (ids.length) nodes.set(node.id, ids)
    }
    const edges = new Map<string, string[]>()
    for (const edge of doc.value.edges) {
      const ids = idsOf(edge).filter((id) => live.has(id))
      if (ids.length) edges.set(edge.id, ids)
    }
    return { nodes, edges, pins }
  })

  const threadsOf = (anchor: FlowCommentAnchor) =>
    ('node' in anchor
      ? openOn.value.nodes.get(anchor.node)
      : openOn.value.edges.get(anchor.edge)) ?? []

  /** The open threads on a node or edge, with those its marker shows for what it hides. */
  const openThere = (anchor: FlowCommentAnchor) => shownOn(anchor) ?? threadsOf(anchor)

  /** The one node or edge selected. */
  function selected(): FlowCommentAnchor | null {
    const { nodes, edges } = selection.value
    if (nodes.length === 1 && !edges.length) return { node: nodes[0]! }
    if (edges.length === 1 && !nodes.length) return { edge: edges[0]! }
    return null
  }

  function show(id: string, focus: boolean) {
    pending.value = null
    open(id)
    if (focus) focusRequest.value++
  }

  /**
   * Opens the threads on a node or edge, the selected one by default, or
   * the box to start one there; with `at`, always the box for a new pin.
   * `focus` puts the focus in the reply box: from the keyboard, not from a
   * tap, which would bring up the keyboard on a phone.
   */
  function start(anchor: FlowCommentAnchor | null = selected(), focus = true): boolean {
    if (!enabled.value || !anchor) return false
    if ('node' in anchor && anchor.at !== undefined) {
      const { node } = anchor
      const at = pinPoint(anchor.at)
      if (!at || !writable.value || !doc.value.nodes.some((n) => n.id === node)) return false
      open(null)
      pending.value = { node, at }
      focusRequest.value++
      return true
    }
    anchor = 'node' in anchor ? { node: anchor.node } : { edge: anchor.edge }
    const there =
      'node' in anchor
        ? doc.value.nodes.some((n) => n.id === anchor.node)
        : doc.value.edges.some((e) => e.id === anchor.edge)
    if (!there) return false
    // one already there, or shown there: open it
    const [first] = openThere(anchor)
    if (first) {
      show(first, focus)
      return true
    }
    if (!writable.value) return false
    open(null)
    pending.value = anchor
    focusRequest.value++
    return true
  }

  function close() {
    pending.value = null
    open(null)
  }

  /** Adds or takes away a thread's id on what it is about; not an undo step. */
  function mark(anchor: FlowCommentAnchor, id: string, add: boolean) {
    let patch: MarkPatch | null = null
    transact(
      (tr) => {
        const item = 'node' in anchor ? tr.getNode(anchor.node) : tr.getEdge(anchor.edge)
        if (!item) return
        const had = idsOf(item)
        const next = add ? [...had.filter((x) => x !== id), id] : had.filter((x) => x !== id)
        patch = { comments: next.length ? next : undefined }
        if ('node' in anchor) {
          const node = item as FlowNode
          const at = add && anchor.at ? pinPoint(anchor.at) : null
          const pins = { ...node.commentPins }
          delete pins[id]
          if (at) pins[id] = at
          // only touched when there are pins, so a plain thread keeps the node as it was
          if (at || node.commentPins)
            patch.commentPins = Object.keys(pins).length ? pins : undefined
          tr.updateNode(anchor.node, patch)
        } else tr.updateEdge(anchor.edge, patch)
      },
      { history: false, origin: 'comment' },
    )
    if (patch) carry(anchor, patch)
  }

  function anchorOf(id: string): FlowCommentAnchor | null {
    const node = doc.value.nodes.find((n) => idsOf(n).includes(id))
    if (node) {
      const at = pinOf(node, id)
      if (!at) return { node: node.id }
      const known = new Set(threads.value.map((t) => t.id))
      const pinned = idsOf(node).filter((other) => known.has(other) && pinOf(node, other))
      return { node: node.id, at, number: pinned.indexOf(id) + 1 }
    }
    const edge = doc.value.edges.find((e) => idsOf(e).includes(id))
    return edge ? { edge: edge.id } : null
  }

  function apply(action: CommentAction) {
    if (action.type === 'create') {
      const anchor = pending.value
      if (!anchor) return
      mark(anchor, action.thread.id, true)
      pending.value = null
    } else if (action.type === 'remove') {
      const anchor = anchorOf(action.threadId)
      if (anchor) mark(anchor, action.threadId, false)
    }
    emit('update:comments', applyCommentAction(threads.value, action))
    emit('commentAction', action)
    if (action.type === 'create') {
      open(action.thread.id)
      focusRequest.value++
    } else if (action.type === 'remove' || action.type === 'resolve') open(null)
  }

  function anchors(): Record<string, FlowCommentAnchor | null> {
    return Object.fromEntries(threads.value.map((thread) => [thread.id, anchorOf(thread.id)]))
  }

  /** Whether `anchor` has something to offer: a thread to open, or one to start. */
  const offered = (anchor: FlowCommentAnchor) =>
    enabled.value && (writable.value || openThere(anchor).length > 0)

  const item = (anchor: FlowCommentAnchor): FlowToolbarItem & ContextMenuItem => ({
    key: 'comment',
    label: messages.value.comment,
    icon: MessagePlusIcon,
    shortcut: KEY,
    showWhenReadonly: true,
    run: () => void start(anchor),
  })

  const extension: FlowExtension = defineFlowExtension({
    name: 'comments',
    keymap: () => ({ [KEY]: () => start() }),
    contextMenu(_, target) {
      if (target.kind === 'canvas') return []
      const anchor = target.kind === 'node' ? { node: target.node.id } : { edge: target.edge.id }
      return offered(anchor) ? [item(anchor)] : []
    },
    toolbarItems(_, nodes) {
      if (nodes.length !== 1) return []
      const anchor = { node: nodes[0]!.id }
      return offered(anchor) ? [item(anchor)] : []
    },
    edgeToolbarItems(_, edges) {
      if (edges.length !== 1) return []
      const anchor = { edge: edges[0]!.id }
      return offered(anchor) ? [item(anchor)] : []
    },
  })

  const comments: FlowComments = {
    enabled,
    writable,
    threads,
    author: computed(() => props.author),
    active,
    pending,
    focusRequest,
    openOn,
    start,
    show,
    apply,
    open,
    close,
    openedHere,
  }

  return { comments, extension, anchors, anchorOf }
}
