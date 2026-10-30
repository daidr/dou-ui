import { Fragment, type Node as PMNode, type Schema } from 'prosemirror-model'
import {
  NodeSelection,
  Selection,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state'
import {
  blockAround,
  blocksIn,
  infoAt,
  nextInDocument,
  previousInDocument,
  selectedRange,
  type BlockInfo,
  type SiblingRange,
} from './blocks'
import { createContentNode, type BlockProps } from './model'
import type { ContentType } from './schema'

const newBlock = (schema: Schema, content: PMNode, children?: Fragment) =>
  schema.nodes.block!.create(
    { id: null },
    children?.size ? [content, schema.nodes.blockGroup!.create(null, children)] : content,
  )

/** The block and content around the cursor, when the selection is inside one textblock. */
function cursorBlock(state: EditorState) {
  const { $from, $to } = state.selection
  if (!$from.parent.isTextblock || !$from.sameParent($to)) return null
  const info = blockAround($from)
  return info && info.content === $from.parent ? info : null
}

/* turning blocks into another type */

/**
 * Turn every block the selection touches into `type`. Text formatting is
 * dropped when it can't be kept (in a code block); a type without text
 * (a divider, an embed) replaces the content and adds an empty paragraph
 * after it to keep typing in.
 */
export function setBlockType(type: ContentType, props: BlockProps = {}): Command {
  return (state, dispatch) => {
    const range = selectedRange(state)
    if (!range) return false
    const schema = state.schema
    const nodeType = schema.nodes[type]
    if (!nodeType) return false
    if (!dispatch) return true
    const tr = state.tr
    const attrs = createContentNode(schema, type, props).attrs
    if (!nodeType.isTextblock) {
      const blocks = blocksIn(range)
      const last = blocks.at(-1)!
      // last first, so earlier positions stay valid
      for (let index = blocks.length - 1; index >= 0; index--) {
        const block = blocks[index]!
        tr.replaceWith(
          block.contentPos,
          block.contentPos + block.content.nodeSize,
          nodeType.create(attrs),
        )
      }
      const after = tr.mapping.map(last.pos + last.node.nodeSize)
      tr.insert(after, newBlock(schema, schema.nodes.paragraph!.create()))
      tr.setSelection(TextSelection.create(tr.doc, after + 2))
      dispatch(tr.scrollIntoView())
      return true
    }
    for (const block of blocksIn(range)) {
      const from = tr.mapping.map(block.contentPos)
      const content = tr.doc.nodeAt(from)!
      if (content.isAtom) {
        tr.replaceWith(from, from + content.nodeSize, nodeType.create(attrs))
      } else {
        // only this content node: the block's children keep their type
        tr.setBlockType(from + 1, from + content.nodeSize - 1, nodeType, attrs)
      }
    }
    const { from, to } = state.selection
    if (state.selection instanceof TextSelection)
      tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from), tr.mapping.map(to)))
    dispatch(tr.scrollIntoView())
    return true
  }
}

/** Set attributes on the content of the block at `pos`, e.g. tick a to-do. */
export function setContentAttrs(pos: number, attrs: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const info = blockAround(state.doc.resolve(pos + 1))
    if (!info) return false
    if (dispatch) {
      const tr = state.tr.setNodeMarkup(info.contentPos, undefined, {
        ...info.content.attrs,
        ...attrs,
      })
      dispatch(tr)
    }
    return true
  }
}

/* Enter */

/**
 * Split the block at the cursor. An empty list item turns back into a
 * paragraph, an empty nested paragraph moves up a level, and a block with
 * children gets its new block as the first child.
 */
export const splitBlock: Command = (state, dispatch) => {
  const schema = state.schema
  let tr = state.tr
  if (!state.selection.empty) {
    if (!cursorBlockAfterDelete(state)) return false
    tr = tr.deleteSelection()
  }
  const $from = tr.selection.$from
  const info = blockAround($from)
  if (!info || info.content !== $from.parent || !$from.parent.isTextblock) return false
  const content = info.content
  const type = content.type.name

  if (content.content.size === 0) {
    if (type !== 'paragraph' && !content.type.spec.code) {
      if (dispatch)
        dispatch(tr.setBlockType($from.pos, $from.pos, schema.nodes.paragraph!).scrollIntoView())
      return true
    }
    if (type === 'paragraph' && info.depth > 1) return liftBlocks(state, dispatch)
  }

  if (!dispatch) return true
  const offset = $from.parentOffset
  // lists continue themselves (with their default attributes: a to-do starts unticked)
  const nextType = content.type.spec.continues ? type : 'paragraph'
  const nextAttrs = null
  const contentEnd = info.contentPos + content.nodeSize - 1

  // at the very start of a non-empty block: open an empty block above it
  if (offset === 0 && content.content.size > 0) {
    const above = newBlock(schema, schema.nodes[nextType]!.create(nextAttrs))
    tr.insert(info.pos, above)
    dispatch(tr.scrollIntoView())
    return true
  }

  const rest = content.content.cut(offset)
  const moved = schema.nodes[nextType]!.create(nextAttrs, rest)
  tr.delete($from.pos, contentEnd)
  const block = newBlock(schema, moved)
  let insertAt: number
  if (info.group) {
    // first child: right below the line the cursor was on
    insertAt = tr.mapping.map(info.contentPos + content.nodeSize) + 1
  } else {
    insertAt = tr.mapping.map(info.pos + info.node.nodeSize)
  }
  tr.insert(insertAt, block)
  tr.setSelection(TextSelection.create(tr.doc, insertAt + 2))
  dispatch(tr.scrollIntoView())
  return true
}

function cursorBlockAfterDelete(state: EditorState) {
  return !!blockAround(state.selection.$from)
}

/** `Shift+Enter`: a line break, or a newline in code. */
export const insertBreak: Command = (state, dispatch) => {
  const { $from } = state.selection
  if (!$from.parent.isTextblock) return false
  if (dispatch) {
    const tr = $from.parent.type.spec.code
      ? state.tr.insertText('\n')
      : state.tr.replaceSelectionWith(state.schema.nodes.hardBreak!.create())
    dispatch(tr.scrollIntoView())
  }
  return true
}

/** In a code block, `Enter` adds a newline. */
export const newlineInCode: Command = (state, dispatch) => {
  const { $from } = state.selection
  if (!$from.parent.type.spec.code) return false
  if (dispatch) dispatch(state.tr.insertText('\n').scrollIntoView())
  return true
}

/** `Mod+Enter` in a code block: leave it for a new paragraph below. */
export const exitCode: Command = (state, dispatch) => {
  const info = cursorBlock(state)
  if (!info || !info.content.type.spec.code) return false
  if (dispatch) {
    const at = info.pos + info.node.nodeSize
    const tr = state.tr.insert(at, newBlock(state.schema, state.schema.nodes.paragraph!.create()))
    tr.setSelection(TextSelection.create(tr.doc, at + 2))
    dispatch(tr.scrollIntoView())
  }
  return true
}

/* Backspace and Delete */

/**
 * Move `source`'s text to the end of `target`'s content and put its
 * children where `source` was.
 */
function mergeInto(tr: Transaction, target: BlockInfo, source: BlockInfo) {
  const joinAt = target.contentPos + target.content.nodeSize - 1
  const children = source.group ? source.group.content : Fragment.empty
  tr.replaceWith(source.pos, source.pos + source.node.nodeSize, children)
  let inline = source.content.content
  if (target.content.type.spec.code) {
    const text = source.content.textContent
    inline = text ? Fragment.from(tr.doc.type.schema.text(text)) : Fragment.empty
  }
  tr.insert(joinAt, inline)
  tr.setSelection(TextSelection.create(tr.doc, joinAt))
}

/**
 * `Backspace` at the start of a block: first turn it into a paragraph, then
 * move a nested block up a level, then join it with the block above.
 */
export const joinBackward: Command = (state, dispatch) => {
  const info = cursorBlock(state)
  if (!info || !state.selection.empty || state.selection.$from.parentOffset > 0) return false
  const type = info.content.type.name
  if (type !== 'paragraph') {
    if (dispatch) {
      const pos = state.selection.from
      dispatch(state.tr.setBlockType(pos, pos, state.schema.nodes.paragraph!))
    }
    return true
  }
  if (info.depth > 1) return liftBlocks(state, dispatch)
  const previous = previousInDocument(state.doc, info)
  if (!previous) return false
  if (!dispatch) return true
  const tr = state.tr
  if (previous.content.isAtom) {
    // the block above is a divider: remove it
    tr.delete(previous.pos, previous.pos + previous.node.nodeSize)
    dispatch(tr.scrollIntoView())
    return true
  }
  mergeInto(tr, previous, info)
  dispatch(tr.scrollIntoView())
  return true
}

/** `Delete` at the end of a block: pull the next block's text up. */
export const joinForward: Command = (state, dispatch) => {
  const info = cursorBlock(state)
  const { $from } = state.selection
  if (!info || !state.selection.empty || $from.parentOffset < $from.parent.content.size)
    return false
  const next = nextInDocument(state.doc, info)
  if (!next) return false
  if (!dispatch) return true
  const tr = state.tr
  if (next.content.isAtom && !next.group) {
    tr.delete(next.pos, next.pos + next.node.nodeSize)
  } else {
    mergeInto(tr, info, next)
  }
  dispatch(tr.scrollIntoView())
  return true
}

/** With a divider selected, `Backspace` or `Delete` removes its block. */
export const deleteSelectedAtom: Command = (state, dispatch) => {
  const selection = state.selection
  if (!(selection instanceof NodeSelection) || !selection.node.isAtom) return false
  const info = blockAround(selection.$from)
  if (!info) return false
  if (dispatch) dispatch(removeBlocks(state.tr, [info]).scrollIntoView())
  return true
}

/* indenting */

/** `Tab`: make the selected blocks children of the block above them. */
export const sinkBlocks: Command = (state, dispatch) => {
  const range = selectedRange(state)
  if (!range || range.from === 0) return false
  if (!dispatch) return true
  const schema = state.schema
  const blocks = blocksIn(range)
  const previousNode = range.parent.child(range.from - 1)
  const previous = infoAt(previousNode, range.start - previousNode.nodeSize, range.depth)
  const moving = Fragment.fromArray(blocks.map((block) => block.node))
  const tr = state.tr
  const { from, to } = state.selection
  tr.delete(range.start, range.end)
  let shift: number
  if (previous.group) {
    const at = previous.pos + previous.node.nodeSize - 2
    tr.insert(at, moving)
    shift = at - range.start
  } else {
    const at = previous.pos + previous.node.nodeSize - 1
    tr.insert(at, schema.nodes.blockGroup!.create(null, moving))
    shift = at + 1 - range.start
  }
  restoreSelection(tr, state, from + shift, to + shift)
  dispatch(tr.scrollIntoView())
  return true
}

/**
 * `Shift+Tab`: move the selected blocks up a level, right after their
 * parent. The siblings that followed them become children of the last one,
 * so nothing changes order.
 */
export const liftBlocks: Command = (state, dispatch) => {
  const range = selectedRange(state)
  if (!range || range.depth <= 1) return false
  if (!dispatch) return true
  const schema = state.schema
  const doc = state.doc
  const $start = doc.resolve(range.start)
  const parentDepth = range.depth - 2
  const parent = infoAt($start.node(parentDepth), $start.before(parentDepth), parentDepth)
  const group = range.parent
  const blocks = blocksIn(range).map((block) => block.node)
  // siblings after the range go under the last moved block
  const following: PMNode[] = []
  for (let index = range.to + 1; index < group.childCount; index++)
    following.push(group.child(index))
  if (following.length) {
    const last = blocks.pop()!
    const ownGroup = last.childCount > 1 ? last.child(1).content : Fragment.empty
    const children = ownGroup.append(Fragment.fromArray(following))
    blocks.push(
      last.copy(
        Fragment.from(last.firstChild!).addToEnd(schema.nodes.blockGroup!.create(null, children)),
      ),
    )
  }
  const kept: PMNode[] = []
  for (let index = 0; index < range.from; index++) kept.push(group.child(index))
  const parentContent = parent.node.firstChild!
  const newParent = parent.node.copy(
    kept.length
      ? Fragment.from(parentContent).addToEnd(group.copy(Fragment.fromArray(kept)))
      : Fragment.from(parentContent),
  )
  const tr = state.tr
  const { from, to } = state.selection
  tr.replaceWith(parent.pos, parent.pos + parent.node.nodeSize, [newParent, ...blocks])
  // the moved blocks now start right after the rebuilt parent
  const shift = parent.pos + newParent.nodeSize - range.start
  restoreSelection(tr, state, from + shift, to + shift)
  dispatch(tr.scrollIntoView())
  return true
}

function restoreSelection(tr: Transaction, state: EditorState, from: number, to: number) {
  const clamp = (pos: number) => Math.max(0, Math.min(pos, tr.doc.content.size))
  if (state.selection instanceof NodeSelection) {
    const $pos = tr.doc.resolve(clamp(from))
    if ($pos.nodeAfter) {
      tr.setSelection(NodeSelection.create(tr.doc, $pos.pos))
      return
    }
  }
  tr.setSelection(TextSelection.between(tr.doc.resolve(clamp(from)), tr.doc.resolve(clamp(to))))
}

/* moving, duplicating and removing blocks */

/** `Mod+Shift+↑/↓`: swap the selected blocks with their neighbour. */
export function moveBlocks(direction: -1 | 1): Command {
  return (state, dispatch) => {
    const range = selectedRange(state)
    if (!range) return false
    const neighbourIndex = direction < 0 ? range.from - 1 : range.to + 1
    if (neighbourIndex < 0 || neighbourIndex >= range.parent.childCount) return false
    if (!dispatch) return true
    const neighbour = range.parent.child(neighbourIndex)
    const tr = state.tr
    const { from, to } = state.selection
    let shift: number
    if (direction < 0) {
      const at = range.start - neighbour.nodeSize
      tr.delete(at, range.start)
      tr.insert(range.end - neighbour.nodeSize, neighbour)
      shift = -neighbour.nodeSize
    } else {
      tr.delete(range.end, range.end + neighbour.nodeSize)
      tr.insert(range.start, neighbour)
      shift = neighbour.nodeSize
    }
    restoreSelection(tr, state, from + shift, to + shift)
    dispatch(tr.scrollIntoView())
    return true
  }
}

/**
 * Drag and drop: move the blocks of `range` to `target`, a position right
 * before or after a block, possibly at another level. Fails when the
 * target is inside the moved blocks. The cursor goes to the first one.
 */
export function moveRangeTo(range: SiblingRange, target: number): Command {
  return (state, dispatch) => {
    if (target >= range.start && target <= range.end) return false
    if (dispatch) {
      const nodes = blocksIn(range).map((block) => block.node)
      const tr = state.tr
      // a group may not be empty: take the whole group when every child moves
      const whole =
        range.parent.type.name === 'blockGroup' &&
        range.from === 0 &&
        range.to === range.parent.childCount - 1
      if (whole) tr.delete(range.start - 1, range.end + 1)
      else tr.delete(range.start, range.end)
      const at = tr.mapping.map(target)
      tr.insert(at, nodes)
      tr.setSelection(Selection.near(tr.doc.resolve(at + 2)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/** Remove blocks, keeping at least one empty paragraph in the document. */
export function removeBlocks(tr: Transaction, blocks: BlockInfo[]): Transaction {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  const sorted = [...blocks].sort((a, b) => b.pos - a.pos)
  for (const block of sorted) {
    const from = tr.mapping.map(block.pos)
    const to = tr.mapping.map(block.pos + block.node.nodeSize)
    const $from = tr.doc.resolve(from)
    // a group may not be empty: remove the whole group when this was its only block
    if ($from.parent.type.name === 'blockGroup' && $from.parent.childCount === 1)
      tr.delete($from.before(), $from.after())
    else tr.delete(from, to)
  }
  if (tr.doc.childCount === 0 || tr.doc.content.size === 0) {
    tr.insert(0, newBlock(tr.doc.type.schema, tr.doc.type.schema.nodes.paragraph!.create()))
  }
  const near = Math.min(tr.mapping.map(sorted.at(-1)!.pos), tr.doc.content.size)
  tr.setSelection(Selection.near(tr.doc.resolve(near)))
  return tr
}

/** Copies of blocks with fresh ids (the id plugin assigns them). */
export function withoutIds(node: PMNode): PMNode {
  if (node.type.name !== 'block' && node.type.name !== 'blockGroup') return node
  const children: PMNode[] = []
  node.forEach((child) => children.push(withoutIds(child)))
  return node.type.name === 'block'
    ? node.type.create({ ...node.attrs, id: null }, children)
    : node.type.create(node.attrs, children)
}

/** Insert copies of the selected blocks right after them. */
export const duplicateBlocks: Command = (state, dispatch) => {
  const range = selectedRange(state)
  if (!range) return false
  if (dispatch) {
    const copies = blocksIn(range).map((block) => withoutIds(block.node))
    const tr = state.tr.insert(range.end, copies)
    dispatch(tr.scrollIntoView())
  }
  return true
}

/** Insert an empty block of `type` after the block at `pos` and put the cursor in it. */
export function insertBlockAfter(pos: number, type: ContentType = 'paragraph'): Command {
  return (state, dispatch) => {
    const info = blockAround(state.doc.resolve(Math.min(pos + 1, state.doc.content.size)))
    if (!info) return false
    if (dispatch) {
      const at = info.pos + info.node.nodeSize
      const content = createContentNode(state.schema, type)
      const tr = state.tr.insert(at, newBlock(state.schema, content))
      tr.setSelection(Selection.near(tr.doc.resolve(at + 2)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/** The selection's blocks, for menus and the block selection. */
export function selectedBlocks(state: EditorState): BlockInfo[] {
  const range = selectedRange(state)
  return range ? blocksIn(range) : []
}
