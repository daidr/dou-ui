import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model'
import { isHistoryTransaction } from 'prosemirror-history'
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { blockAround } from './blocks'
import type { BlockProps } from './model'

/*
 * Comment threads are anchored by a `comment` mark carrying the thread's
 * id on the text they are about, or inside a block that keeps them in its
 * props (its spec's `comments`, e.g. the nodes of a whiteboard). The
 * threads themselves (comments, replies, resolved) are kept outside the
 * document.
 */

/** Where a thread is inside a block: what to show for it, and the block's own description of the spot. */
export interface BlockCommentAnchor<Target = unknown> {
  /** The text of what the thread is about, e.g. a node's label; `''` when it has none. */
  text: string
  /** Where in the block, as the block describes it, e.g. `{ node: 'n1' }`. */
  target: Target
}

/**
 * How a block type keeps comment threads on what is inside it, in its
 * props: the `comments` field of its spec. The block's component starts
 * and shows those threads itself (see `useEditor().comments`); the editor
 * lists them in `getCommentAnchors()`, leaves them out of pasted copies,
 * and puts them back after undo and redo, which restore older props.
 */
export interface BlockCommentsSpec<Target = unknown> {
  /** The threads in the block, by id. */
  anchors: (props: BlockProps) => Record<string, BlockCommentAnchor<Target>>
  /** The props with thread `id` on `target`; `null` when that isn't in the block any more. */
  place: (props: BlockProps, id: string, target: Target) => BlockProps | null
  /** The props with only the threads `keep` says yes to. */
  strip: (props: BlockProps, keep: (id: string) => boolean) => BlockProps
}

declare module 'prosemirror-model' {
  interface NodeSpec {
    /** Comment threads kept inside the block's props, see `BlockCommentsSpec`. */
    // oxlint-disable-next-line typescript/no-explicit-any -- each block type has its own target
    comments?: BlockCommentsSpec<any>
  }
}

/** The `comments` of a node's spec: a block type that keeps threads inside. */
export const blockCommentsOf = (node: PMNode) =>
  node.type.spec.comments as BlockCommentsSpec | undefined

/** A range of the document, as positions. */
export interface CommentRange {
  from: number
  to: number
}

/** Where a thread is anchored: the block and the text it is about. */
export interface CommentAnchor {
  /** The id of the (first) block holding the text, or of the block the thread is inside. */
  block: string
  /** The text the thread is about; inside a block, what the block shows for it (e.g. a node's label). */
  text: string
  /** The text's first and last positions; inside a block, the block's. */
  from: number
  to: number
  /** Inside a block: the block's type. */
  type?: string
  /** Inside a block: where, as the block describes it (e.g. `{ node: 'n1' }` on a whiteboard). */
  target?: unknown
}

export interface CommentPluginState {
  /** The text a thread is being started on, until its first comment is sent. */
  pending: CommentRange | null
  decorations: DecorationSet
}

export const commentKey = new PluginKey<CommentPluginState>('dou-editor-comments')

type CommentMeta = { pending: CommentRange | null }

export interface CommentPluginOptions {
  /** The ids of the threads there are, or `null` when comments are off. */
  known: () => ReadonlySet<string> | null
  /** A click on text that is in threads, with their ids, innermost first; `[]` elsewhere. */
  onClick: (ids: string[]) => void
  onPending: (range: CommentRange | null) => void
  /** Text got selected (a range, not a cursor). */
  onSelect: () => void
}

const pendingDecorations = (doc: PMNode, range: CommentRange | null) =>
  range && range.to > range.from
    ? DecorationSet.create(doc, [
        Decoration.inline(range.from, range.to, { class: 'dou-editor__comment-pending' }),
      ])
    : DecorationSet.empty

/** The ids of the threads at `pos`, the shortest (innermost) first. */
export function commentsAt(state: EditorState, pos: number): string[] {
  const $pos = state.doc.resolve(pos)
  const node = $pos.parent.childAfter($pos.parentOffset).node
  if (!node) return []
  const ids = node.marks
    .filter((mark) => mark.type.name === 'comment')
    .map((mark) => mark.attrs.id as string)
  if (ids.length < 2) return ids
  const length = new Map(ids.map((id) => [id, rangeLength(state.doc, id, pos)]))
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh list
  return ids.sort((a, b) => length.get(a)! - length.get(b)!)
}

/** How long the run of `id`'s text around `pos` is, within its textblock. */
function rangeLength(doc: PMNode, id: string, pos: number): number {
  const $pos = doc.resolve(pos)
  const start = $pos.start()
  let runStart = -1
  let around = false
  let length = Infinity
  $pos.parent.forEach((child, offset) => {
    const at = start + offset
    const end = at + child.nodeSize
    if (child.marks.some((mark) => mark.type.name === 'comment' && mark.attrs.id === id)) {
      if (runStart < 0) runStart = at
      if (at <= pos && pos <= end) around = true
      if (around) length = end - runStart
    } else {
      if (around) around = false
      runStart = -1
    }
  })
  return length
}

/** Every thread's anchor in the document, by id: the first and last positions of its text. */
export function commentAnchors(doc: PMNode): Map<string, CommentAnchor> {
  const anchors = new Map<string, CommentAnchor>()
  doc.descendants((node, pos) => {
    const inside = blockCommentsOf(node)
    if (inside) {
      const block = (doc.resolve(pos).parent.attrs.id as string | undefined) ?? ''
      for (const [id, at] of Object.entries(inside.anchors(node.attrs))) {
        if (anchors.has(id)) continue
        const to = pos + node.nodeSize
        anchors.set(id, {
          block,
          text: at.text,
          from: pos,
          to,
          type: node.type.name,
          target: at.target,
        })
      }
      return false
    }
    if (!node.isText) return true
    for (const mark of node.marks) {
      if (mark.type.name !== 'comment') continue
      const id = mark.attrs.id as string
      const end = pos + node.nodeSize
      const anchor = anchors.get(id)
      if (anchor) {
        anchor.to = end
        anchor.text += node.text
      } else {
        const block = blockAround(doc.resolve(pos))
        anchors.set(id, {
          block: (block?.node.attrs.id as string | undefined) ?? '',
          text: node.text ?? '',
          from: pos,
          to: end,
        })
      }
    }
    return false
  })
  return anchors
}

/** The text of `id`'s anchor that a thread card points at: its first and last positions. */
export function commentRange(doc: PMNode, id: string): CommentRange | null {
  let from = -1
  let to = -1
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    if (node.marks.some((mark) => mark.type.name === 'comment' && mark.attrs.id === id)) {
      if (from < 0) from = pos
      to = pos + node.nodeSize
    }
    return false
  })
  return from < 0 ? null : { from, to }
}

/** Marks `range` as the text of a new thread. Not undone with the edits around it. */
export function anchorComment(view: EditorView, range: CommentRange, id: string) {
  const type = view.state.schema.marks.comment!
  const tr = view.state.tr.addMark(range.from, range.to, type.create({ id }))
  tr.setMeta(commentKey, { pending: null } satisfies CommentMeta)
  tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

/** Sets the props of the block content at `pos` that differ in `next`. */
function setProps(tr: Transaction, pos: number, before: BlockProps, next: BlockProps) {
  for (const [name, value] of Object.entries(next))
    if (Object.hasOwn(before, name) && before[name] !== value) tr.setNodeAttribute(pos, name, value)
}

/** The id of the block around the content node at `pos`. */
const blockIdAt = (doc: PMNode, pos: number) =>
  (doc.resolve(pos).parent.attrs.id as string | undefined) ?? ''

/** Takes a removed thread's anchor off the text, or out of the block it is inside. */
export function unanchorComment(view: EditorView, id: string) {
  const type = view.state.schema.marks.comment!
  const tr = view.state.tr
  view.state.doc.descendants((node, pos) => {
    const inside = blockCommentsOf(node)
    if (inside) {
      if (Object.hasOwn(inside.anchors(node.attrs), id))
        setProps(
          tr,
          pos,
          node.attrs,
          inside.strip(node.attrs, (other) => other !== id),
        )
      return false
    }
    if (!node.isText) return true
    const mark = node.marks.find((m) => m.type === type && m.attrs.id === id)
    if (mark) tr.removeMark(pos, pos + node.nodeSize, mark)
    return false
  })
  if (!tr.docChanged) return
  tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

export function setPendingComment(view: EditorView, range: CommentRange | null) {
  view.dispatch(view.state.tr.setMeta(commentKey, { pending: range } satisfies CommentMeta))
}

/**
 * A pasted copy of commented text doesn't take the thread along: the
 * thread keeps its one anchor. Text that was cut is no longer in the
 * document, so its threads come along with it.
 */
function dropCopiedComments(slice: Slice, state: EditorState, known: ReadonlySet<string> | null) {
  const inDoc = new Set<string>()
  let any = false
  slice.content.descendants((node) => {
    if (node.marks.some((mark) => mark.type.name === 'comment')) any = true
    const inside = blockCommentsOf(node)
    if (inside && Object.keys(inside.anchors(node.attrs)).length) any = true
    return !any
  })
  if (!any) return slice
  state.doc.descendants((node) => {
    for (const mark of node.marks) if (mark.type.name === 'comment') inDoc.add(mark.attrs.id)
    const inside = blockCommentsOf(node)
    if (inside) for (const id of Object.keys(inside.anchors(node.attrs))) inDoc.add(id)
    return true
  })
  const keep = (id: string) => !inDoc.has(id) && (!known || known.has(id))
  const strip = (fragment: Fragment): Fragment => {
    const nodes: PMNode[] = []
    fragment.forEach((node) => {
      const inside = blockCommentsOf(node)
      if (node.isText) {
        nodes.push(
          node.mark(node.marks.filter((m) => m.type.name !== 'comment' || keep(m.attrs.id))),
        )
      } else if (inside) {
        const attrs = { ...node.attrs, ...inside.strip(node.attrs, keep) }
        nodes.push(node.type.create(attrs, strip(node.content), node.marks))
      } else nodes.push(node.copy(strip(node.content)))
    })
    return Fragment.from(nodes)
  }
  return new Slice(strip(slice.content), slice.openStart, slice.openEnd)
}

/** The threads inside each block that keeps them, by block id. */
function blockAnchors(doc: PMNode) {
  const found = new Map<string, Record<string, BlockCommentAnchor>>()
  doc.descendants((node, pos) => {
    const inside = blockCommentsOf(node)
    if (!inside) return true
    found.set(blockIdAt(doc, pos), inside.anchors(node.attrs))
    return false
  })
  return found
}

/**
 * Undo and redo bring back a block's props as they were, threads included,
 * but starting and deleting threads aren't steps of the history: each block
 * keeps the threads it had before, put back where they were if that is
 * still there. A block brought back by the undo keeps what it comes with.
 */
function keepBlockComments(before: PMNode, state: EditorState): Transaction | null {
  const had = blockAnchors(before)
  if (!had.size) return null
  const tr = state.tr
  state.doc.descendants((node, pos) => {
    const inside = blockCommentsOf(node)
    if (!inside) return true
    const anchors = had.get(blockIdAt(state.doc, pos))
    if (!anchors) return false
    let props = inside.strip(node.attrs, (id) => Object.hasOwn(anchors, id))
    const now = inside.anchors(props)
    for (const [id, at] of Object.entries(anchors)) {
      if (Object.hasOwn(now, id)) continue
      props = inside.place(props, id, at.target) ?? props
    }
    if (props !== node.attrs) setProps(tr, pos, node.attrs, props)
    return false
  })
  return tr.docChanged ? tr.setMeta('addToHistory', false) : null
}

export function commentPlugin(options: CommentPluginOptions): Plugin<CommentPluginState> {
  return new Plugin<CommentPluginState>({
    key: commentKey,
    appendTransaction: (trs, before, state) =>
      trs.some((tr) => tr.docChanged && isHistoryTransaction(tr))
        ? keepBlockComments(before.doc, state)
        : null,
    state: {
      init: () => ({ pending: null, decorations: DecorationSet.empty }),
      apply(tr: Transaction, value: CommentPluginState): CommentPluginState {
        const meta = tr.getMeta(commentKey) as CommentMeta | undefined
        let pending = value.pending
        if (meta) pending = meta.pending
        else if (pending && tr.docChanged) {
          const from = tr.mapping.map(pending.from, 1)
          const to = tr.mapping.map(pending.to, -1)
          pending = to > from ? { from, to } : null
        }
        if (pending === value.pending && !tr.docChanged) return value
        return { pending, decorations: pendingDecorations(tr.doc, pending) }
      },
    },
    view: () => {
      let last: CommentRange | null = null
      return {
        update(view, previous) {
          const pending = commentKey.getState(view.state)!.pending
          if (pending !== last) options.onPending((last = pending))
          const { selection } = view.state
          // a selection made by the user, not one moved along by an edit
          if (
            !selection.empty &&
            view.state.doc === previous.doc &&
            !selection.eq(previous.selection)
          )
            options.onSelect()
        },
      }
    },
    props: {
      decorations: (state) => commentKey.getState(state)!.decorations,
      transformPasted: (slice, view) => dropCopiedComments(slice, view.state, options.known()),
      handleClick(view, pos, event) {
        if (event.button !== 0 || !options.known()) return false
        const known = options.known()!
        options.onClick(commentsAt(view.state, pos).filter((id) => known.has(id)))
        return false
      },
    },
  })
}
