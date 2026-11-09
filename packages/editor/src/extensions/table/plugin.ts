import type { Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state'
import { TableMap } from 'prosemirror-tables'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { createId } from '../../core/model'
import { fitColumns, isHeaderAt } from './schema'

/** Tables only sit in blocks; text and other content need no visit. */
const descends = (node: PMNode) => node.type.name === 'block' || node.type.name === 'blockGroup'

const sameColumns = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Keep every table well formed after each change: a unique id on every
 * row, one column record per column, and header cells exactly where the
 * table's `headerRow` / `headerColumn` say.
 */
function normalize(doc: PMNode, tr: Transaction) {
  const rowIds = new Set<string>()
  doc.descendants((node, pos) => {
    if (node.type.spec.tableRole !== 'table') return descends(node)
    const map = TableMap.get(node)
    const columns = fitColumns(node.attrs.columns, map.width)
    if (!sameColumns(columns, node.attrs.columns)) tr.setNodeAttribute(pos, 'columns', columns)
    const start = pos + 1
    node.forEach((row, offset) => {
      const id = row.attrs.id as string | null
      if (!id || rowIds.has(id)) tr.setNodeAttribute(start + offset, 'id', createId())
      else rowIds.add(id)
    })
    const seen = new Set<number>()
    for (const cellPos of map.map) {
      if (seen.has(cellPos)) continue
      seen.add(cellPos)
      const rect = map.findCell(cellPos)
      const cell = node.nodeAt(cellPos)!
      const header = isHeaderAt(node.attrs, rect.top, rect.left)
      const type = header ? node.type.schema.nodes.tableHeader! : node.type.schema.nodes.tableCell!
      if (cell.type !== type) tr.setNodeMarkup(start + cellPos, type, cell.attrs)
    }
    return false
  })
}

/** Text alignment per column, laid on the cells. */
function alignments(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.spec.tableRole !== 'table') return descends(node)
    const columns = node.attrs.columns as { align?: string }[]
    if (!columns.some((column) => column.align)) return false
    const map = TableMap.get(node)
    const seen = new Set<number>()
    for (const cellPos of map.map) {
      if (seen.has(cellPos)) continue
      seen.add(cellPos)
      const align = columns[map.findCell(cellPos).left]?.align
      if (!align) continue
      const cell = node.nodeAt(cellPos)!
      const from = pos + 1 + cellPos
      decorations.push(
        Decoration.node(from, from + cell.nodeSize, { style: `text-align: ${align}` }),
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

/**
 * The margins beside the text column (the surface's padding, from a reading
 * width), in px on the mount, for top-level tables to reach into. Read from
 * the padding the surface already has, so any way of writing the reading
 * width works; kept up to date as the mount or the column changes size.
 */
class Margins {
  private readonly observer: ResizeObserver | null = null
  private readonly mount: HTMLElement | null

  constructor(private readonly view: EditorView) {
    const mount = view.dom.parentElement
    this.mount = mount?.classList.contains('dou-editor__mount') ? mount : null
    if (!this.mount || typeof ResizeObserver === 'undefined') return
    this.observer = new ResizeObserver(() => this.measure())
    // the mount's width, and the column's (the padding changes with the reading width)
    this.observer.observe(this.mount)
    this.observer.observe(view.dom)
  }

  private measure() {
    const mount = this.mount
    if (!mount) return
    const style = getComputedStyle(this.view.dom)
    for (const [name, value] of [
      ['--dou-editor-margin-start', style.paddingInlineStart],
      ['--dou-editor-margin-end', style.paddingInlineEnd],
    ] as const) {
      if (mount.style.getPropertyValue(name) !== value) mount.style.setProperty(name, value)
    }
  }

  destroy() {
    this.observer?.disconnect()
    this.mount?.style.removeProperty('--dou-editor-margin-start')
    this.mount?.style.removeProperty('--dou-editor-margin-end')
  }
}

export const tableKey = new PluginKey<DecorationSet>('dou-editor-table')

export function tablePlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: tableKey,
    state: {
      init: (_config, state) => alignments(state.doc),
      apply: (tr, value, _old, state) => (tr.docChanged ? alignments(state.doc) : value),
    },
    appendTransaction(trs, _old, state) {
      if (!trs.some((tr) => tr.docChanged)) return null
      const tr = state.tr
      normalize(state.doc, tr)
      return tr.docChanged ? tr : null
    },
    props: {
      decorations: (state) => tableKey.getState(state),
    },
    view: (view) => new Margins(view),
  })
}
