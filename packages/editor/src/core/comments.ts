import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { blockAround } from './blocks'

/*
 * Comment threads are anchored by a `comment` mark carrying the thread's
 * id on the text they are about. The threads themselves (comments,
 * replies, resolved) are kept outside the document.
 */

/** A range of the document, as positions. */
export interface CommentRange {
  from: number
  to: number
}

/** Where a thread is anchored: the block and the text it is about. */
export interface CommentAnchor {
  /** The id of the (first) block holding the text. */
  block: string
  /** The text the thread is about. */
  text: string
  from: number
  to: number
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

/** Takes a removed thread's anchor off the text. */
export function unanchorComment(view: EditorView, id: string) {
  const type = view.state.schema.marks.comment!
  const tr = view.state.tr
  view.state.doc.descendants((node, pos) => {
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
    return !any
  })
  if (!any) return slice
  state.doc.descendants((node) => {
    for (const mark of node.marks) if (mark.type.name === 'comment') inDoc.add(mark.attrs.id)
    return true
  })
  const keep = (id: string) => !inDoc.has(id) && (!known || known.has(id))
  const strip = (fragment: Fragment): Fragment => {
    const nodes: PMNode[] = []
    fragment.forEach((node) => {
      if (node.isText) {
        nodes.push(
          node.mark(node.marks.filter((m) => m.type.name !== 'comment' || keep(m.attrs.id))),
        )
      } else nodes.push(node.copy(strip(node.content)))
    })
    return Fragment.from(nodes)
  }
  return new Slice(strip(slice.content), slice.openStart, slice.openEnd)
}

export function commentPlugin(options: CommentPluginOptions): Plugin<CommentPluginState> {
  return new Plugin<CommentPluginState>({
    key: commentKey,
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
        update(view) {
          const pending = commentKey.getState(view.state)!.pending
          if (pending !== last) options.onPending((last = pending))
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
