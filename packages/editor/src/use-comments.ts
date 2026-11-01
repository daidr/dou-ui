import { applyCommentAction, type CommentAction, type CommentThread } from 'dou-ui'
import { TextSelection, type EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { computed, shallowRef, watch, type ShallowRef } from 'vue'
import {
  anchorComment,
  commentAnchors,
  commentPlugin,
  setPendingComment,
  unanchorComment,
  type CommentAnchor,
  type CommentRange,
} from './core/comments'
import type { CommentsProvider } from './core/extension'
import type { EditorComments, EditorEmits, EditorProps } from './editor'

type Emit = <K extends keyof EditorEmits>(event: K, ...args: EditorEmits[K]) => void

/** The selected text in a read-only editor, which keeps no selection of its own. */
function domSelection(view: EditorView): CommentRange | null {
  const selection = view.dom.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!view.dom.contains(range.startContainer) || !view.dom.contains(range.endContainer))
    return null
  try {
    const from = view.posAtDOM(range.startContainer, range.startOffset)
    const to = view.posAtDOM(range.endContainer, range.endOffset)
    return to > from ? { from, to } : null
  } catch {
    return null
  }
}

/** Whether a range holds text a thread can be about: not only a divider, not in code. */
function hasText(state: EditorState, range: CommentRange) {
  let text = false
  state.doc.nodesBetween(range.from, range.to, (node) => {
    if (text) return false
    if (!node.isTextblock) return true
    text = !node.type.spec.code && node.content.size > 0
    return false
  })
  return text
}

export function useEditorComments(options: {
  props: EditorProps
  emit: Emit
  view: ShallowRef<EditorView | null>
  provider: CommentsProvider | null
}) {
  const { props, emit, view, provider } = options

  const threads = computed<readonly CommentThread[]>(
    () => provider?.threads.value ?? props.comments ?? [],
  )
  const enabled = computed(() => !!provider || props.comments !== undefined)
  const writable = computed(() => enabled.value && !!props.author && props.commentable !== false)
  const known = computed(() => new Set(threads.value.map((thread) => thread.id)))

  // the shared document's threads, mirrored to `v-model:comments`
  if (provider)
    watch(provider.threads, (value) => emit('update:comments', [...value]), { immediate: true })

  const innerActive = shallowRef<string | null>(null)
  const active = computed(() =>
    props.activeComment === undefined ? innerActive.value : props.activeComment,
  )
  function open(id: string | null) {
    if (id === active.value) return
    innerActive.value = id
    emit('update:activeComment', id)
  }

  const pending = shallowRef<CommentRange | null>(null)

  function selection(): CommentRange | null {
    const current = view.value
    if (!current) return null
    const range = current.editable
      ? current.state.selection instanceof TextSelection && !current.state.selection.empty
        ? { from: current.state.selection.from, to: current.state.selection.to }
        : null
      : domSelection(current)
    return range && hasText(current.state, range) ? range : null
  }

  function start(): boolean {
    const current = view.value
    const range = selection()
    if (!current || !range || !writable.value) return false
    open(null)
    setPendingComment(current, range)
    return true
  }

  function close() {
    const current = view.value
    if (current && pending.value) setPendingComment(current, null)
    open(null)
  }

  function apply(action: CommentAction) {
    const current = view.value
    if (action.type === 'create') {
      const range = pending.value
      if (!current || !range) return
      anchorComment(current, range, action.thread.id)
    } else if (
      current &&
      (action.type === 'remove' ||
        (action.type === 'delete' &&
          threads.value.find((thread) => thread.id === action.threadId)?.comments[0]?.id ===
            action.commentId))
    )
      unanchorComment(current, action.threadId)
    if (provider) provider.apply(action)
    else emit('update:comments', applyCommentAction(threads.value, action))
    emit('comment', action)
    if (action.type === 'create') open(action.thread.id)
    else if (action.type === 'remove' || action.type === 'resolve') open(null)
  }

  const plugin = commentPlugin({
    known: () => (enabled.value ? known.value : null),
    onClick: (ids) => {
      const first = ids.find((id) => {
        const thread = threads.value.find((item) => item.id === id)
        return thread && !thread.resolved
      })
      if (pending.value && view.value) setPendingComment(view.value, null)
      open(first ?? null)
    },
    onPending: (range) => (pending.value = range),
  })

  function anchors(): Record<string, CommentAnchor | null> {
    const found = view.value ? commentAnchors(view.value.state.doc) : new Map()
    return Object.fromEntries(
      threads.value.map((thread) => [thread.id, found.get(thread.id) ?? null]),
    )
  }

  const comments: EditorComments = {
    enabled,
    writable,
    threads,
    author: computed(() => props.author),
    active,
    pending,
    selection,
    start,
    apply,
    open,
    close,
  }

  return { comments, plugin, anchors }
}
