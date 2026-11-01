import { applyCommentAction, type CommentAction, type CommentThread } from 'dou-ui'
import { computed, onMounted, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { SheetPoint } from './core/address'
import { sheetCommentAnchors, type SheetCommentAnchor } from './core/comments'
import type { SheetCommentsProvider } from './core/extension'
import type { SheetWorkbook } from './core/model'
import { sheetKey, type SheetTransaction, type SheetTransactionMeta } from './core/transaction'
import type { SheetEmits, SheetProps } from './types'

type Emit = <K extends keyof SheetEmits>(event: K, ...args: SheetEmits[K]) => void

/** Whether a thread shows: known and not resolved. */
const isOpen = (thread: CommentThread | undefined) => !!thread && !thread.resolved

/** A cell of a sheet, by the sheet's key. */
export interface SheetCommentCell extends SheetPoint {
  sheet: string
}

/**
 * The comment threads of a sheet: which one is open beside its cell, the
 * cell a new one is being written for, and the changes made from the card.
 */
export function useSheetComments(options: {
  props: SheetProps
  emit: Emit
  provider: ComputedRef<SheetCommentsProvider | null>
  doc: Readonly<Ref<SheetWorkbook>>
  /** The cell a thread on `point` of the sheet shown goes on: a merge's top left. */
  home: (point: SheetPoint) => SheetPoint
  /** The key of the sheet shown. */
  shown: () => string
  transact: (
    run: (tr: SheetTransaction) => void,
    meta?: SheetTransactionMeta,
  ) => SheetTransaction | null
}) {
  const { props, emit, provider, doc, home, shown, transact } = options

  const threads = computed<readonly CommentThread[]>(
    () => provider.value?.threads.value ?? props.comments ?? [],
  )
  // comparing with an older version shows the cells only
  const enabled = computed(
    () => (!!provider.value || props.comments !== undefined) && !props.compare,
  )
  const writable = computed(() => enabled.value && !!props.author && props.commentable !== false)
  const byId = computed(() => new Map(threads.value.map((thread) => [thread.id, thread])))

  // the shared document's threads, mirrored to `v-model:comments`; from the
  // mount on, when the extensions have the grid to work with
  onMounted(() =>
    watch(
      () => provider.value?.threads.value,
      (value) => value && emit('update:comments', [...value]),
      { immediate: true },
    ),
  )

  const innerActive = shallowRef<string | null>(null)
  const active = computed(() =>
    props.activeComment === undefined ? innerActive.value : props.activeComment,
  )
  function open(id: string | null) {
    if (id === active.value) return
    innerActive.value = id
    emit('update:activeComment', id)
  }

  /** The cell a new thread is being written for. */
  const pending = shallowRef<SheetCommentCell | null>(null)
  /** Bumped to put the cursor in the card's reply box. */
  const focusRequest = shallowRef(0)

  /** The thread a cell of the sheet shown names; `undefined` when it names none (or one not known). */
  function threadAt(point: SheetPoint) {
    const at = home(point)
    const cell = doc.value.sheets.find((sheet) => sheetKey(sheet) === shown())?.cells[at.row]?.[
      at.col
    ]
    const id = cell && typeof cell === 'object' ? cell.comment : undefined
    return id ? byId.value.get(id) : undefined
  }

  const anchors = computed(() => (enabled.value ? sheetCommentAnchors(doc.value) : new Map()))

  /** Where the card is: the cell being commented on, or the open thread's. */
  const cell = computed<SheetCommentCell | null>(() => {
    if (pending.value) return pending.value
    const id = active.value
    const anchor = id ? anchors.value.get(id) : undefined
    return anchor ? { sheet: anchor.sheet, row: anchor.row, col: anchor.col } : null
  })

  /**
   * The thread about a cell of the sheet shown, ready to reply to; or the
   * box to start one. `false` when there is neither.
   */
  function start(point: SheetPoint): boolean {
    if (!enabled.value) return false
    const at = home(point)
    const thread = threadAt(at)
    if (thread) {
      pending.value = null
      open(thread.id)
      focusRequest.value++
      return true
    }
    if (!writable.value) return false
    open(null)
    pending.value = { sheet: shown(), ...at }
    focusRequest.value++
    return true
  }

  /** Opens the open thread on a cell just clicked, or closes the card when it has none. */
  function show(point: SheetPoint) {
    if (!enabled.value) return
    const thread = threadAt(point)
    pending.value = null
    open(isOpen(thread) ? thread!.id : null)
  }

  function close() {
    pending.value = null
    open(null)
  }

  const meta = { history: false, action: 'comment' } as const

  function apply(action: CommentAction) {
    if (action.type === 'create') {
      const at = pending.value
      if (!at) return
      transact((tr) => tr.setComment(at, action.thread.id), meta)
      pending.value = null
    } else if (action.type === 'remove') {
      const anchor = anchors.value.get(action.threadId)
      if (anchor) transact((tr) => tr.setComment(anchor, undefined), meta)
    }
    if (provider.value) provider.value.apply(action)
    else emit('update:comments', applyCommentAction(threads.value, action))
    emit('commentAction', action)
    if (action.type === 'create') {
      open(action.thread.id)
      focusRequest.value++
    } else if (action.type === 'remove' || action.type === 'resolve') open(null)
  }

  function getAnchors(): Record<string, SheetCommentAnchor | null> {
    const found = sheetCommentAnchors(doc.value)
    return Object.fromEntries(
      threads.value.map((thread) => [thread.id, found.get(thread.id) ?? null]),
    )
  }

  return {
    enabled,
    writable,
    threads,
    byId,
    active,
    pending,
    cell,
    focusRequest,
    threadAt,
    isOpen,
    start,
    show,
    open,
    close,
    apply,
    getAnchors,
  }
}

export type SheetComments = ReturnType<typeof useSheetComments>
