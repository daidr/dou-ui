import type { Node as PMNode, ResolvedPos } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'

/** A `block` node and where it sits. */
export interface BlockInfo {
  node: PMNode
  /** The position right before the block. */
  pos: number
  /** Its depth in the document; top-level blocks are at depth 1. */
  depth: number
  /** The block's content node (paragraph, heading, …). */
  content: PMNode
  /** The position right before the content node. */
  contentPos: number
  /** The children, if any. */
  group: PMNode | null
}

export function infoAt(node: PMNode, pos: number, depth: number): BlockInfo {
  return {
    node,
    pos,
    depth,
    content: node.firstChild!,
    contentPos: pos + 1,
    group: node.childCount > 1 ? node.child(1) : null,
  }
}

/** The innermost block around a position, or `null` between blocks. */
export function blockAround($pos: ResolvedPos): BlockInfo | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.name === 'block') return infoAt(node, $pos.before(depth), depth)
  }
  // right before a block, e.g. a node selection of it
  const after = $pos.nodeAfter
  if (after?.type.name === 'block') return infoAt(after, $pos.pos, $pos.depth + 1)
  return null
}

/** The block with an id, by scanning the document. */
export function findBlockById(doc: PMNode, id: string): BlockInfo | null {
  let found: BlockInfo | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'block' && node.attrs.id === id) {
      found = infoAt(node, pos, doc.resolve(pos).depth + 1)
      return false
    }
    // blocks only live in the doc and in groups; skip inline content
    return node.type.name === 'block' || node.type.name === 'blockGroup'
  })
  return found
}

/** A run of sibling blocks inside one container (the doc or a group). */
export interface SiblingRange {
  /** The container: the doc or a `blockGroup`. */
  parent: PMNode
  /** The position where the container's content starts. */
  parentStart: number
  /** Depth of the blocks. */
  depth: number
  /** First and last index, inclusive. */
  from: number
  to: number
  /** Positions before the first and after the last block. */
  start: number
  end: number
}

function rangeOf(doc: PMNode, a: BlockInfo, b: BlockInfo): SiblingRange {
  const $a = doc.resolve(a.pos)
  const $b = doc.resolve(b.pos)
  const parent = $a.parent
  return {
    parent,
    parentStart: $a.start(),
    depth: a.depth,
    from: $a.index(),
    to: $b.index(),
    start: a.pos,
    end: b.pos + b.node.nodeSize,
  }
}

/** The outer block at `depth` that contains `info`. */
function climb(doc: PMNode, info: BlockInfo, depth: number): BlockInfo {
  if (info.depth === depth) return info
  const $pos = doc.resolve(info.pos + 1)
  return infoAt($pos.node(depth), $pos.before(depth), depth)
}

/**
 * The sibling blocks a selection spans. When its ends sit at different
 * levels, the range climbs to the level they share.
 */
export function siblingRangeBetween(doc: PMNode, from: number, to: number): SiblingRange | null {
  let a = blockAround(doc.resolve(from))
  let b = blockAround(doc.resolve(to))
  if (!a || !b) return null
  // climb two levels at a time (block > group > block) until both share a parent
  let depth = Math.min(a.depth, b.depth)
  for (;;) {
    a = climb(doc, a, depth)
    b = climb(doc, b, depth)
    if (doc.resolve(a.pos).start() === doc.resolve(b.pos).start()) break
    depth -= 2
  }
  return rangeOf(doc, a, b)
}

export function selectedRange(state: EditorState): SiblingRange | null {
  const { from, to } = state.selection
  return siblingRangeBetween(state.doc, from, to)
}

/** The blocks of a range, in order. */
export function blocksIn(range: SiblingRange): BlockInfo[] {
  const list: BlockInfo[] = []
  let pos = range.parentStart
  range.parent.forEach((node, offset, index) => {
    if (index >= range.from && index <= range.to) list.push(infoAt(node, pos + offset, range.depth))
  })
  return list
}

/** Every block in document order, outer before inner. */
export function allBlocks(doc: PMNode): BlockInfo[] {
  const list: BlockInfo[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'block') list.push(infoAt(node, pos, doc.resolve(pos).depth + 1))
    return node.type.name === 'block' || node.type.name === 'blockGroup' || node.type.name === 'doc'
  })
  return list
}

/** The deepest last block inside a block (itself when it has no children). */
export function lastDescendant(info: BlockInfo): BlockInfo {
  let current = info
  while (current.group) {
    const group = current.group
    const lastPos =
      current.pos +
      1 +
      current.content.nodeSize +
      1 +
      group.content.size -
      group.lastChild!.nodeSize
    current = infoAt(group.lastChild!, lastPos, current.depth + 2)
  }
  return current
}

/** The block that comes before `info` when reading top to bottom. */
export function previousInDocument(doc: PMNode, info: BlockInfo): BlockInfo | null {
  const $pos = doc.resolve(info.pos)
  const index = $pos.index()
  if (index > 0) {
    const before = $pos.parent.child(index - 1)
    return lastDescendant(infoAt(before, info.pos - before.nodeSize, info.depth))
  }
  // the first child: the previous is its parent block
  if (info.depth > 1)
    return infoAt($pos.node(info.depth - 2), $pos.before(info.depth - 2), info.depth - 2)
  return null
}

/** The block that comes after `info` when reading top to bottom. */
export function nextInDocument(doc: PMNode, info: BlockInfo): BlockInfo | null {
  if (info.group)
    return infoAt(info.group.firstChild!, info.pos + 1 + info.content.nodeSize + 1, info.depth + 2)
  let current = info
  for (;;) {
    const $pos = doc.resolve(current.pos)
    const end = current.pos + current.node.nodeSize
    if ($pos.index() < $pos.parent.childCount - 1)
      return infoAt($pos.parent.child($pos.index() + 1), end, current.depth)
    if (current.depth <= 1) return null
    current = infoAt(
      $pos.node(current.depth - 2),
      $pos.before(current.depth - 2),
      current.depth - 2,
    )
  }
}
