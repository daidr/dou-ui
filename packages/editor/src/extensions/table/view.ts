import type { Node as PMNode } from 'prosemirror-model'
import { TableView } from 'prosemirror-tables'
import type { NodeView, ViewMutationRecord } from 'prosemirror-view'

/** The narrowest a column gets, without a width of its own and when resized. */
export const CELL_MIN_WIDTH = 96

/**
 * A table in the editor: a scrolling frame (the block's content element)
 * around the table, with a `<colgroup>` that holds the column widths.
 */
export class TableBlockView extends TableView implements NodeView {
  constructor(node: PMNode) {
    super(node, CELL_MIN_WIDTH)
    this.dom.className = 'dou-editor__content dou-editor__content--table'
    this.dom.dataset.contentType = 'table'
    this.table.className = 'dou-editor-table'
  }

  override ignoreMutation(record: ViewMutationRecord) {
    // the frame's scroll position and classes are ours
    return record.type === 'attributes' && record.target === this.dom
      ? true
      : super.ignoreMutation(record)
  }
}
