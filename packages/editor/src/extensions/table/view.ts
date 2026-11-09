import type { Node as PMNode } from 'prosemirror-model'
import { TableView } from 'prosemirror-tables'
import type { NodeView, ViewMutationRecord } from 'prosemirror-view'

/** The narrowest a column gets, without a width of its own and when resized. */
export const CELL_MIN_WIDTH = 96

/**
 * A table in the editor: a scrolling frame (the block's content element)
 * around the table, with a `<colgroup>` that holds the column widths. When
 * columns are cut off at either side of the frame, that side has a shadow:
 * `is-cut-start` / `is-cut-end` on the frame.
 */
export class TableBlockView extends TableView implements NodeView {
  private readonly observer: ResizeObserver | null = null
  private readonly onScroll = () => this.edges()

  constructor(node: PMNode) {
    super(node, CELL_MIN_WIDTH)
    this.dom.className = 'dou-editor__content dou-editor__content--table'
    this.dom.dataset.contentType = 'table'
    this.table.className = 'dou-editor-table'
    this.dom.addEventListener('scroll', this.onScroll, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      // the frame's width, and the table's (columns added, removed, resized)
      this.observer = new ResizeObserver(this.onScroll)
      this.observer.observe(this.dom)
      this.observer.observe(this.table)
    }
  }

  /** Which sides cut columns off: the table's edges against the frame's, padding left out. */
  private edges() {
    const frame = this.dom
    const style = getComputedStyle(frame)
    const start = Number.parseFloat(style.paddingInlineStart) || 0
    const end = Number.parseFloat(style.paddingInlineEnd) || 0
    const hidden = frame.scrollWidth - frame.clientWidth
    frame.classList.toggle('is-cut-start', frame.scrollLeft > start + 0.5)
    frame.classList.toggle('is-cut-end', frame.scrollLeft < hidden - end - 0.5)
  }

  override ignoreMutation(record: ViewMutationRecord) {
    // the frame's scroll position and classes are ours
    return record.type === 'attributes' && record.target === this.dom
      ? true
      : super.ignoreMutation(record)
  }

  destroy() {
    this.dom.removeEventListener('scroll', this.onScroll)
    this.observer?.disconnect()
  }
}
