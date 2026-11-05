import { applyCommentAction, type CommentAction, type CommentThread } from 'dou-ui'
import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import type { DashboardStep, DashboardTransactionMeta } from '../core/transaction'
import type { DashboardDocument } from '../core/types'
import type { DashboardCommentAnchor, DashboardEmits, DashboardProps } from './types'

type Emit = <K extends keyof DashboardEmits>(event: K, ...args: DashboardEmits[K]) => void

/** The thread ids on a widget; nothing when a hand-written document has something else there. */
export const commentIdsOf = (widget: { comments?: unknown }): string[] =>
  Array.isArray(widget.comments) ? widget.comments.filter((id) => typeof id === 'string') : []

/**
 * The comments of a dashboard: which widget each thread is about, the thread
 * open now, and the one being started.
 */
export function useDashboardComments(options: {
  props: Omit<DashboardProps, 'modelValue' | 'filters'>
  emit: Emit
  model: Ref<DashboardDocument>
  run: (steps: DashboardStep[], meta: DashboardTransactionMeta) => unknown
  /** Keeps a change out of undo on the widget as undo and redo bring it back. */
  carry: (id: string, patch: { comments: string[] | undefined }) => void
}) {
  const { props, emit, model, run, carry } = options

  const threads = computed<readonly CommentThread[]>(() => props.comments ?? [])
  const enabled = computed(() => props.comments !== undefined)
  const writable = computed(() => enabled.value && !!props.author && props.commentable !== false)

  const innerActive = shallowRef<string | null>(null)
  const active = computed(() =>
    props.activeComment === undefined ? innerActive.value : props.activeComment,
  )
  /** The last thread this dashboard opened, so a `v-model:activeComment` echoing it isn't taken for one from outside. */
  let ownOpen: string | null = null
  function open(id: string | null) {
    if (id === active.value) return
    innerActive.value = id
    ownOpen = id
    emit('update:activeComment', id)
  }
  const openedHere = (id: string | null) => id === ownOpen

  /** The widget a thread is being started on, until its first comment is sent. */
  const pending = shallowRef<string | null>(null)
  /** Goes up when the open card should take the focus, ready for a reply. */
  const focusRequest = shallowRef(0)

  /** The open threads on each widget, oldest first. */
  const openOn: ComputedRef<Map<string, string[]>> = computed(() => {
    const live = new Set(threads.value.filter((t) => !t.resolved).map((t) => t.id))
    const out = new Map<string, string[]>()
    for (const widget of model.value.widgets) {
      const ids = commentIdsOf(widget).filter((id) => live.has(id))
      if (ids.length) out.set(widget.id, ids)
    }
    return out
  })

  function widgetOf(id: string): string | null {
    return model.value.widgets.find((widget) => commentIdsOf(widget).includes(id))?.id ?? null
  }

  /** The widget the card is for: the one a thread is being started on, or the open thread's. */
  const current = computed<string | null>(() => {
    if (pending.value) return pending.value
    const id = active.value
    return id ? widgetOf(id) : null
  })

  /** The threads the card shows: every open one on the widget, or the open one if it is resolved. */
  const shown = computed<CommentThread[]>(() => {
    const widget = current.value
    if (!widget || pending.value) return []
    const ids = openOn.value.get(widget) ?? []
    const list = active.value && !ids.includes(active.value) ? [...ids, active.value] : ids
    const byId = new Map(threads.value.map((t) => [t.id, t]))
    return list.flatMap((id) => byId.get(id) ?? [])
  })

  /**
   * Opens the discussions on a widget, or the box to start one. `focus`
   * puts the focus in the reply box: from the keyboard, not from a tap,
   * which would bring up the keyboard on a phone.
   */
  function start(widget: string, focus = true): boolean {
    if (!enabled.value || !model.value.widgets.some((w) => w.id === widget)) return false
    // one already there: open it, ready to reply
    const [first] = openOn.value.get(widget) ?? []
    if (first) {
      pending.value = null
      open(first)
      if (focus) focusRequest.value++
      return true
    }
    if (!writable.value) return false
    open(null)
    pending.value = widget
    focusRequest.value++
    return true
  }

  function close() {
    pending.value = null
    open(null)
  }

  /** Adds or takes away a thread's id on its widget; not an undo step. */
  function mark(widget: string, id: string, add: boolean) {
    const found = model.value.widgets.find((w) => w.id === widget)
    if (!found) return
    const had = commentIdsOf(found)
    const next = add ? [...had.filter((x) => x !== id), id] : had.filter((x) => x !== id)
    const patch = { comments: next.length ? next : undefined }
    run([{ type: 'update', id: widget, patch }], { history: false, origin: 'comment' })
    carry(widget, patch)
  }

  function apply(action: CommentAction) {
    if (action.type === 'create') {
      const widget = pending.value
      if (!widget) return
      mark(widget, action.thread.id, true)
      pending.value = null
    } else if (action.type === 'remove') {
      const widget = widgetOf(action.threadId)
      if (widget) mark(widget, action.threadId, false)
    }
    emit('update:comments', applyCommentAction(threads.value, action))
    emit('commentAction', action)
    if (action.type === 'create') {
      open(action.thread.id)
      focusRequest.value++
    } else if (action.type === 'remove' || action.type === 'resolve') open(null)
  }

  function anchors(): Record<string, DashboardCommentAnchor | null> {
    return Object.fromEntries(
      threads.value.map((thread) => {
        const widget = widgetOf(thread.id)
        return [thread.id, widget ? { widget } : null]
      }),
    )
  }

  return {
    enabled,
    writable,
    threads,
    author: computed(() => props.author),
    active,
    pending,
    focusRequest,
    openOn,
    current,
    shown,
    start,
    apply,
    open,
    close,
    openedHere,
    anchors,
    widgetOf,
  }
}

export type DashboardComments = ReturnType<typeof useDashboardComments>
