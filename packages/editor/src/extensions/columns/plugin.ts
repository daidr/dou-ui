import type { Node as PMNode } from 'prosemirror-model'
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state'
import { AttrStep } from 'prosemirror-transform'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { getBlockSelection, selectBlocks } from '../../core/block-selection'
import { blockAround, blocksIn, layoutOf, siblingRangeBetween } from '../../core/blocks'
import { changesBlockStructure, isRemote } from '../../core/plugins'

const descends = (node: PMNode) => node.type.name === 'block' || node.type.name === 'blockGroup'

/** Remove the block at `pos`, or its group when it is the only block there (a group may not be empty). */
function removeBlock(tr: Transaction, pos: number) {
  const $pos = tr.doc.resolve(pos)
  const node = tr.doc.nodeAt(pos)!
  if ($pos.parent.type.name === 'blockGroup' && $pos.parent.childCount === 1)
    tr.delete($pos.before(), $pos.after())
  else tr.delete(pos, pos + node.nodeSize)
}

/** Put the block at `pos` in place of its children. */
function unwrap(tr: Transaction, pos: number, block: PMNode) {
  const group = block.childCount > 1 ? block.child(1) : null
  if (group) tr.replaceWith(pos, pos + block.nodeSize, group.content)
  else removeBlock(tr, pos)
}

/**
 * Find the first thing wrong with the columns of `tr.doc` and fix it.
 * Fixes only move and remove blocks, never add any: two editors fixing
 * the same remote change both end up with the same document.
 */
function fixOne(tr: Transaction): boolean {
  const doc = tr.doc
  // positions in `doc`, mapped through this round's steps only
  const first = tr.steps.length
  const map = (pos: number) => tr.mapping.slice(first).map(pos)
  let fixed = false
  doc.descendants((node, pos) => {
    if (fixed) return false
    if (node.type.name !== 'block') return descends(node)
    const layout = layoutOf(node)
    if (!layout) return true
    const $pos = doc.resolve(pos)
    const owner = $pos.depth > 0 ? $pos.node($pos.depth - 1) : null
    const group = node.childCount > 1 ? node.child(1) : null
    if (layout === 'column') {
      // a column outside a set of columns: its blocks take its place
      if (layoutOf(owner) !== 'row') unwrap(tr, pos, node)
      // an empty column goes away
      else if (!group) removeBlock(tr, pos)
      else return true
      fixed = true
      return false
    }
    // a set of columns inside a column: columns don't nest, its columns take its place
    for (let depth = $pos.depth; depth > 0; depth--) {
      if (layoutOf($pos.node(depth)) !== 'column') continue
      unwrap(tr, pos, node)
      fixed = true
      return false
    }
    if (!group) {
      removeBlock(tr, pos)
      fixed = true
      return false
    }
    const columns: { node: PMNode; pos: number }[] = []
    const strays: { node: PMNode; pos: number }[] = []
    const start = pos + 1 + node.firstChild!.nodeSize + 1
    group.forEach((child, offset) => {
      const entry = { node: child, pos: start + offset }
      if (layoutOf(child) === 'column') columns.push(entry)
      else strays.push(entry)
    })
    const stray = strays[0]
    if (!columns.length || (columns.length === 1 && !stray)) {
      // one column (or none) is no set of columns: its blocks take its place
      const only = columns[0]
      if (only) unwrap(tr, only.pos, only.node)
      unwrap(tr, map(pos), tr.doc.nodeAt(map(pos))!)
      fixed = true
      return false
    }
    if (stray) {
      // a block between columns joins the column before it, or the first one
      const before = columns.filter((column) => column.pos < stray.pos).at(-1)
      const target = before ?? columns[0]!
      const at = before
        ? target.pos + target.node.nodeSize - 2
        : target.pos + 1 + target.node.firstChild!.nodeSize + 1
      tr.delete(stray.pos, stray.pos + stray.node.nodeSize)
      tr.insert(map(at), stray.node)
      fixed = true
      return false
    }
    return true
  })
  if (fixed && tr.doc.childCount === 0) {
    const schema = tr.doc.type.schema
    tr.insert(0, schema.nodes.block!.create(null, schema.nodes.paragraph!.create()))
  }
  return fixed
}

/** A column's width while its bar is dragged: shown, not yet in the document. */
export interface ColumnPreview {
  /** The position before the column's block. */
  pos: number
  width: number
}

interface ColumnsState {
  decorations: DecorationSet
  preview: ColumnPreview[] | null
}

/** Each column's width, as a style on its block, and its name for screen readers. */
function widths(doc: PMNode, preview: ColumnPreview[] | null, label: ColumnLabel): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'block') return descends(node)
    if (layoutOf(node) !== 'row') return true
    const group = node.childCount > 1 ? node.child(1) : null
    let at = pos + 1 + node.firstChild!.nodeSize + 1
    group?.forEach((column, _offset, index) => {
      const shown = preview?.find((entry) => entry.pos === at)
      const width = shown ? shown.width : (column.firstChild!.attrs.width as number | null)
      if (width && width !== 1)
        decorations.push(
          Decoration.node(at, at + column.nodeSize, {
            style: `--dou-editor-column-width: ${width}`,
          }),
        )
      // the column's blocks, named after its place
      const inner = at + 1 + column.firstChild!.nodeSize
      if (column.childCount > 1)
        decorations.push(
          Decoration.node(inner, inner + column.child(1).nodeSize, {
            'aria-label': label(index + 1, group.childCount),
          }),
        )
      at += column.nodeSize
    })
    return true
  })
  return DecorationSet.create(doc, decorations)
}

/** The name of a column: its place among the columns of its set. */
export type ColumnLabel = (index: number, count: number) => string

export const columnsKey = new PluginKey<ColumnsState>('dou-editor-columns')

/** Show `preview` widths without changing the document, or stop showing them (`null`). */
export function previewColumns(tr: Transaction, preview: ColumnPreview[] | null): Transaction {
  return tr.setMeta(columnsKey, { preview }).setMeta('addToHistory', false)
}

/** Lay the columns out again, e.g. after the locale changed their names. */
export const refreshColumns = (tr: Transaction) =>
  tr.setMeta(columnsKey, {}).setMeta('addToHistory', false)

/** The column around a position: the position before its block, or -1 outside columns. */
function columnAt(state: EditorState, pos: number): number {
  const $pos = state.doc.resolve(pos)
  for (let depth = $pos.depth; depth > 0; depth--)
    if (layoutOf($pos.node(depth)) === 'column') return $pos.before(depth)
  return -1
}

/**
 * A text selection from one column into another, or between a column and
 * the blocks around the set: the whole blocks instead, so deleting it or
 * typing over it never joins text across columns.
 */
function selectAcross(state: EditorState): Transaction | null {
  const { selection } = state
  if (!(selection instanceof TextSelection) || selection.empty || getBlockSelection(state))
    return null
  // an end at the very start of the next block (or the very end of the one
  // before) is where the browser puts a selection that stops at a line
  // break: that block isn't selected
  const { $from, $to } = selection
  const doc = state.doc
  let from = selection.from
  let to = selection.to
  if ($to.parentOffset === 0 && $to.parent.isTextblock) {
    const block = blockAround($to)
    const before = block && Selection.findFrom(doc.resolve(block.pos), -1, true)
    if (before && before.from > from) to = before.from
  }
  if ($from.parentOffset === $from.parent.content.size && $from.parent.isTextblock) {
    const block = blockAround($from)
    const after =
      block && Selection.findFrom(doc.resolve(block.contentPos + block.content.nodeSize), 1, true)
    if (after && after.from < to) from = after.from
  }
  if (columnAt(state, from) === columnAt(state, to)) return null
  const range = siblingRangeBetween(doc, from, to)
  if (!range) return null
  const blocks = blocksIn(range)
  const [first, last] = [blocks[0]!.node.attrs.id, blocks.at(-1)!.node.attrs.id] as string[]
  const backwards = selection.head < selection.anchor
  let result: Transaction | null = null
  selectBlocks(backwards ? last! : first!, backwards ? first! : last!)(state, (tr) => {
    result = tr
  })
  return result
}

/**
 * Keeps columns well formed after every change, also one from another
 * collaborator (the fix is the same everywhere): columns only in a set of
 * columns, at least one block in each, at least two in a set, no set of
 * columns in a column. Lays each column's width on it, and turns a text
 * selection across columns into a selection of the whole blocks.
 */
export function columnsPlugin(label: ColumnLabel): Plugin<ColumnsState> {
  return new Plugin<ColumnsState>({
    key: columnsKey,
    state: {
      init: (_config, state) => ({ decorations: widths(state.doc, null, label), preview: null }),
      apply: (tr, value, _old, state) => {
        const meta = tr.getMeta(columnsKey) as { preview?: ColumnPreview[] | null } | undefined
        let preview = value.preview
        if (meta?.preview !== undefined) preview = meta.preview
        else if (preview && tr.docChanged)
          preview = preview.map((entry) => ({ ...entry, pos: tr.mapping.map(entry.pos) }))
        if (
          meta ||
          (tr.docChanged &&
            (changesBlockStructure(tr) || tr.steps.some((step) => step instanceof AttrStep)))
        )
          return { decorations: widths(state.doc, preview, label), preview }
        if (!tr.docChanged) return value
        return { decorations: value.decorations.map(tr.mapping, tr.doc), preview }
      },
    },
    appendTransaction(trs, _old, state) {
      if (trs.some((tr) => changesBlockStructure(tr))) {
        const tr = state.tr
        for (let round = 0; round < 64 && fixOne(tr); round++);
        if (tr.docChanged) {
          if (trs.every(isRemote)) tr.setMeta('addToHistory', false)
          return tr
        }
      }
      return trs.some((tr) => tr.selectionSet) ? selectAcross(state) : null
    },
    props: {
      decorations(state) {
        return this.getState(state)?.decorations
      },
    },
  })
}
