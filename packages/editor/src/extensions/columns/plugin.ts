import type { Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state'
import { AttrStep } from 'prosemirror-transform'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { layoutOf } from '../../core/blocks'
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
    // a set of columns
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

/** Each column's width, as a style on its block. */
function widths(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'block') return descends(node)
    const width = node.firstChild!.attrs.width as number | null | undefined
    if (layoutOf(node) === 'column' && width)
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { style: `--dou-editor-column-width: ${width}` }),
      )
    return true
  })
  return DecorationSet.create(doc, decorations)
}

export const columnsKey = new PluginKey<DecorationSet>('dou-editor-columns')

/**
 * Keeps columns well formed after every change, also one from another
 * collaborator (the fix is the same everywhere): columns only in a set of
 * columns, at least one block in each, at least two in a set. And lays
 * each column's width on it.
 */
export function columnsPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: columnsKey,
    state: {
      init: (_config, state) => widths(state.doc),
      apply: (tr, value, _old, state) =>
        !tr.docChanged
          ? value
          : changesBlockStructure(tr) || tr.steps.some((step) => step instanceof AttrStep)
            ? widths(state.doc)
            : value.map(tr.mapping, tr.doc),
    },
    appendTransaction(trs, _old, state) {
      if (!trs.some((tr) => changesBlockStructure(tr))) return null
      const tr = state.tr
      for (let round = 0; round < 64 && fixOne(tr); round++);
      if (!tr.docChanged) return null
      if (trs.every(isRemote)) tr.setMeta('addToHistory', false)
      return tr
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}
