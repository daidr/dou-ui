import type { Node as PMNode, Schema } from 'prosemirror-model'
import {
  NodeSelection,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state'
import { blockAround, findBlockById, layoutOf, parentBlock, type BlockInfo } from './blocks'
import { blockSelectionRange } from './block-selection'
import {
  blockFromNode,
  contentAttrs,
  createContentNode,
  createId,
  nodeFromBlock,
  type Block,
  type BlockProps,
  type InlineContent,
  type PartialBlock,
  type PartialTableRow,
} from './model'
import type { ContentType } from './schema'
import { closeHistory } from 'prosemirror-history'
import type { EditorView } from 'prosemirror-view'
import { originKey } from './editor'

/**
 * Where blocks go: right before or after a block, or among a block's
 * children (`parent: null` is the top level). `index` counts from 0 and
 * defaults to the end.
 */
export type BlockPlacement =
  { before: string } | { after: string } | { parent: string | null; index?: number }

/** The parts of a block to change. `props` are merged into the current ones. */
export interface BlockPatch {
  type?: ContentType
  props?: BlockProps
  /** Inline content, or plain text. */
  content?: InlineContent[] | string
  rows?: PartialTableRow[]
  /** Replaces all children; `[]` removes them. */
  children?: PartialBlock[]
}

export interface EditorTransactionMeta {
  /** `false` keeps the change out of undo, e.g. a fix made by the program. */
  history?: boolean
  /** Who made the change; passed on to the `transaction` event. */
  origin?: string
}

/** Where a selection is put inside a block: at the start of its text or at the end. */
export type BlockEdge = 'start' | 'end'

/**
 * Set on a transaction that is an undo step of its own, for history
 * providers other than the built-in one (collaboration reads it).
 */
export const ownStepKey = 'douOwnStep'

const warn = (message: string) => {
  if (process.env.NODE_ENV !== 'production') console.warn(`[@dou-ui/editor] ${message}`)
}

/**
 * Changes made by blocks and ids, applied together as one undo step. Ids
 * are looked up in the document as it is after the earlier calls.
 */
export class EditorTransaction {
  /** The ProseMirror transaction underneath, for anything the methods don't cover. */
  readonly tr: Transaction
  readonly meta: EditorTransactionMeta
  /** `focusBlock` was called: the editor takes focus once the changes are applied. */
  focused = false

  constructor(
    /** The state the changes start from. */
    readonly before: EditorState,
    meta: EditorTransactionMeta = {},
    /**
     * Whether the selection was placed by the user or the program. An editor
     * that never had focus has its selection at the start, which is no cursor.
     */
    private readonly hasCursor = true,
  ) {
    this.tr = before.tr
    this.meta = { ...meta }
  }

  get changed(): boolean {
    return this.tr.docChanged
  }

  setMeta(meta: EditorTransactionMeta): this {
    Object.assign(this.meta, meta)
    return this
  }

  /** A block as it is now, or `null`. */
  getBlock(id: string): Block | null {
    const info = findBlockById(this.tr.doc, id)
    return info ? blockFromNode(info.node) : null
  }

  /**
   * Insert blocks, by default after the block with the cursor (at the end
   * without one). Returns the new blocks' ids; an id already in the
   * document is replaced with a fresh one.
   */
  insertBlocks(blocks: PartialBlock[], placement?: BlockPlacement): string[] {
    if (!blocks.length) return []
    const tr = this.tr
    const schema = tr.doc.type.schema
    const taken = usedIds(tr.doc)
    const ids: string[] = []
    const nodes = blocks.map((block) => {
      const node = nodeFromBlock(schema, freshIds(block, taken), true)
      ids.push(node.attrs.id as string)
      return node
    })
    const target = placement ?? this.defaultPlacement()
    if (insertNodes(tr, target, nodes) === null) return []
    for (const id of ids) {
      const info = findBlockById(tr.doc, id)
      if (layoutOf(info?.node) === 'row' && info && inColumn(tr.doc, info))
        warn(
          `insertBlocks: columns don't go in a column; the block "${id}" is replaced by its columns' blocks`,
        )
    }
    return ids
  }

  /** Change a block's type, props, content or children. Returns `false` when it isn't found. */
  updateBlock(id: string, patch: BlockPatch): boolean {
    const tr = this.tr
    const info = findBlockById(tr.doc, id)
    if (!info) {
      warn(`updateBlock: no block with the id "${id}"`)
      return false
    }
    const schema = tr.doc.type.schema
    // check everything before changing anything: a refused patch changes nothing
    const typeName = patch.type ?? info.content.type.name
    const nodeType = schema.nodes[typeName]
    if (!nodeType?.isInGroup('blockContent')) {
      warn(`updateBlock: unknown block type "${typeName}"`)
      return false
    }
    const rowsSpec = !!nodeType.spec.rows
    if (patch.rows !== undefined && !rowsSpec) {
      warn(`updateBlock: a "${typeName}" block has no rows`)
      return false
    }
    if (patch.content !== undefined && (rowsSpec || !nodeType.inlineContent)) {
      warn(`updateBlock: a "${typeName}" block has no text content`)
      return false
    }
    if (patch.children) replaceChildren(tr, info, patch.children)
    if (
      patch.type === undefined &&
      patch.props === undefined &&
      patch.content === undefined &&
      patch.rows === undefined
    )
      return true
    const current = findBlockById(tr.doc, id)!
    const content = current.content
    const props = { ...content.attrs, ...patch.props }
    const keepsContent = patch.content === undefined && patch.rows === undefined
    // keep the text node for node when it can stay: collaborators typing in it keep their place
    if (keepsContent && nodeType === content.type) {
      tr.setNodeMarkup(current.contentPos, undefined, contentAttrs(nodeType, props))
      return true
    }
    if (keepsContent && nodeType.isTextblock && content.isTextblock) {
      const from = current.contentPos
      tr.setBlockType(
        from + 1,
        from + content.nodeSize - 1,
        nodeType,
        contentAttrs(nodeType, props),
      )
      return true
    }
    const block = blockFromNode(current.node)
    const next = createContentNode(
      schema,
      typeName,
      props,
      patch.content ?? block.content,
      patch.rows ?? block.rows,
    )
    tr.replaceWith(current.contentPos, current.contentPos + content.nodeSize, next)
    return true
  }

  /** Remove blocks with their children. The document always keeps one block. */
  removeBlocks(ids: string[]): boolean {
    const infos = outermost(this.tr.doc, ids, 'removeBlocks')
    if (!infos.length) return false
    deleteInfos(this.tr, infos)
    const tr = this.tr
    if (tr.doc.content.size === 0) tr.insert(0, emptyBlock(tr.doc.type.schema))
    return true
  }

  /**
   * Move blocks, in the order given, to `placement`. Fails when it is
   * inside one of them.
   */
  moveBlocks(ids: string[], placement: BlockPlacement): boolean {
    const tr = this.tr
    const infos = outermost(tr.doc, ids, 'moveBlocks')
    if (!infos.length) return false
    const anchor =
      'before' in placement
        ? placement.before
        : 'after' in placement
          ? placement.after
          : placement.parent
    if (
      anchor !== null &&
      infos.some((info) => info.node.attrs.id === anchor || contains(info, tr.doc, anchor))
    ) {
      warn('moveBlocks: blocks cannot be moved next to or into themselves')
      return false
    }
    // insert the moved blocks first, then delete the originals: the document never empties
    const nodes = infos.map((info) => info.node)
    // a selection inside a moved block goes along with it
    const { anchor: anchorPos, head } = tr.selection
    const nodeSelected = tr.selection instanceof NodeSelection
    const carried = infos.findIndex(
      (info) =>
        anchorPos > info.pos &&
        anchorPos < info.pos + info.node.nodeSize &&
        head > info.pos &&
        head < info.pos + info.node.nodeSize,
    )
    const base = tr.steps.length
    const at = insertNodes(tr, placement, nodes)
    if (at === null) return false
    const inserted = tr.steps.length
    deleteInfos(tr, infos, base)
    if (carried >= 0) {
      const info = infos[carried]!
      let start = at
      for (let i = 0; i < carried; i++) start += nodes[i]!.nodeSize
      const moved = tr.mapping.slice(inserted).map(start, 1)
      const shift = (pos: number) => moved + (pos - info.pos)
      tr.setSelection(
        nodeSelected
          ? NodeSelection.create(tr.doc, shift(anchorPos))
          : TextSelection.create(tr.doc, shift(anchorPos), shift(head)),
      )
    }
    return true
  }

  /** Put the cursor at the start or end of a block's text (or select a block without text). */
  focusBlock(id: string, edge: BlockEdge = 'end'): boolean {
    const tr = this.tr
    const info = findBlockById(tr.doc, id)
    if (!info) {
      warn(`focusBlock: no block with the id "${id}"`)
      return false
    }
    tr.setSelection(selectionIn(tr, info, edge)).scrollIntoView()
    this.focused = true
    return true
  }

  /** After the selection's block, or at the end. */
  private defaultPlacement(): BlockPlacement {
    if (!this.hasCursor && !this.tr.selectionSet) return { parent: null }
    // selected blocks are only known before the first change
    const range = this.tr.docChanged ? null : blockSelectionRange(this.before)
    const id = range
      ? (range.parent.child(range.to).attrs.id as string)
      : (blockAround(this.tr.selection.$to)?.node.attrs.id as string | undefined)
    return id ? { after: id } : { parent: null }
  }
}

function emptyBlock(schema: Schema): PMNode {
  return schema.nodes.block!.create({ id: createId() }, schema.nodes.paragraph!.create())
}

function usedIds(doc: PMNode): Set<string> {
  const ids = new Set<string>()
  doc.descendants((node) => {
    if (node.type.name === 'block') ids.add(node.attrs.id as string)
    return node.type.name === 'block' || node.type.name === 'blockGroup'
  })
  return ids
}

/** The block with ids that are free, recursively. */
function freshIds(block: PartialBlock, taken: Set<string>): PartialBlock {
  let id = block.id
  if (!id || taken.has(id)) id = createId()
  taken.add(id)
  return {
    ...block,
    id,
    children: block.children?.map((child) => freshIds(child, taken)),
  }
}

/** Whether a block with `id` sits inside `info`. */
function contains(info: BlockInfo, doc: PMNode, id: string): boolean {
  const found = findBlockById(doc, id)
  return !!found && found.pos > info.pos && found.pos < info.pos + info.node.nodeSize
}

/** The blocks with these ids, without those inside another one of them, in the order given. */
function outermost(doc: PMNode, ids: string[], method: string): BlockInfo[] {
  const infos: BlockInfo[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const info = findBlockById(doc, id)
    if (info) infos.push(info)
    else warn(`${method}: no block with the id "${id}"`)
  }
  return infos.filter(
    (info) =>
      !infos.some(
        (other) =>
          other !== info && info.pos > other.pos && info.pos < other.pos + other.node.nodeSize,
      ),
  )
}

/**
 * Delete blocks found in the document as it was after step `base`; a
 * group left without children goes too.
 */
function deleteInfos(tr: Transaction, infos: BlockInfo[], base = tr.steps.length) {
  // last first, so the earlier positions stay valid
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  const sorted = [...infos].sort((a, b) => b.pos - a.pos)
  for (const info of sorted) {
    // a block moved right in front of this one pushes it on (`1`)
    const from = tr.mapping.slice(base).map(info.pos, 1)
    const to = from + info.node.nodeSize
    const $from = tr.doc.resolve(from)
    if ($from.parent.type.name === 'blockGroup' && $from.parent.childCount === 1)
      tr.delete($from.before(), $from.after())
    else tr.delete(from, to)
  }
}

/** Insert block nodes at a placement. Returns `false` when the placement can't be found. */
function insertNodes(tr: Transaction, placement: BlockPlacement, nodes: PMNode[]): number | null {
  const schema = tr.doc.type.schema
  let at: number
  if ('before' in placement || 'after' in placement) {
    const id = 'before' in placement ? placement.before : placement.after
    const info = findBlockById(tr.doc, id)
    if (!info) {
      warn(`no block with the id "${id}" to insert next to`)
      return null
    }
    at = 'before' in placement ? info.pos : info.pos + info.node.nodeSize
  } else if (placement.parent === null) {
    at = childPos(0, tr.doc, placement.index)
  } else {
    const info = findBlockById(tr.doc, placement.parent)
    if (!info) {
      warn(`no block with the id "${placement.parent}" to insert into`)
      return null
    }
    if (!info.group) {
      at = info.contentPos + info.content.nodeSize
      tr.insert(at, schema.nodes.blockGroup!.create(null, nodes))
      return at + 1
    }
    at = childPos(info.contentPos + info.content.nodeSize + 1, info.group, placement.index)
  }
  tr.insert(at, nodes)
  return at
}

/** The position before the child at `index` of a container whose content starts at `start`. */
function childPos(start: number, container: PMNode, index = container.childCount) {
  const at = Math.max(0, Math.min(index, container.childCount))
  let pos = start
  for (let i = 0; i < at; i++) pos += container.child(i).nodeSize
  return pos
}

/** Whether a block sits in a column, at any depth. */
function inColumn(doc: PMNode, info: BlockInfo): boolean {
  for (let parent = parentBlock(doc, info); parent; parent = parentBlock(doc, parent))
    if (layoutOf(parent.node) === 'column') return true
  return false
}

function replaceChildren(tr: Transaction, info: BlockInfo, children: PartialBlock[]) {
  const schema = tr.doc.type.schema
  const groupPos = info.contentPos + info.content.nodeSize
  const taken = usedIds(tr.doc)
  // the old children's ids are free again
  info.group?.descendants((node) => {
    if (node.type.name === 'block') taken.delete(node.attrs.id as string)
  })
  const nodes = children.map((child) => nodeFromBlock(schema, freshIds(child, taken), true))
  const group = nodes.length ? schema.nodes.blockGroup!.create(null, nodes) : null
  const end = info.group ? groupPos + info.group.nodeSize : groupPos
  if (group) tr.replaceWith(groupPos, end, group)
  else if (info.group) tr.delete(groupPos, end)
}

/** A cursor at the start or end of a block's text; a node selection for a block without text. */
export function selectionIn(tr: Transaction, info: BlockInfo, edge: BlockEdge): Selection {
  const content = info.content
  const doc = tr.doc
  if (content.isTextblock) {
    const pos = edge === 'start' ? info.contentPos + 1 : info.contentPos + content.nodeSize - 1
    return TextSelection.create(doc, pos)
  }
  if (content.isAtom) return NodeSelection.create(doc, info.contentPos)
  // a table: the first or last cell's text
  const inside = edge === 'start' ? info.contentPos + 1 : info.contentPos + content.nodeSize - 1
  return Selection.near(doc.resolve(inside), edge === 'start' ? 1 : -1)
}

/**
 * Apply a transaction made with `transact`: one undo step of its own,
 * unless `history` is `false`. Returns whether anything happened.
 */
export function applyEditorTransaction(view: EditorView, transaction: EditorTransaction): boolean {
  const { tr, meta } = transaction
  if (!tr.docChanged && !tr.selectionSet) return false
  if (meta.origin !== undefined) tr.setMeta(originKey, meta.origin)
  if (!tr.docChanged) {
    view.dispatch(tr)
    return true
  }
  if (meta.history === false) {
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
    return true
  }
  view.dispatch(closeHistory(tr).setMeta(ownStepKey, true))
  // and typing right after it starts another step
  view.dispatch(closeHistory(view.state.tr))
  return true
}
