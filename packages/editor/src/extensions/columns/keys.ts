import { Selection, type Command } from 'prosemirror-state'
import {
  blockAround,
  layoutOf,
  nextInDocument,
  parentBlock,
  previousInDocument,
} from '../../core/blocks'
import { sinkBlocks } from '../../core/commands'

/**
 * `↑` on the first line of a column and `↓` on its last: the cursor goes to
 * the block above or below the set of columns, as it looks, instead of
 * into the column beside (the next one in the document).
 */
function leave(direction: -1 | 1): Command {
  return (state, dispatch, view) => {
    const { selection } = state
    if (!selection.empty || !view?.endOfTextblock(direction < 0 ? 'up' : 'down')) return false
    const doc = state.doc
    const block = blockAround(selection.$head)
    if (!block) return false
    // only at the first or last block of the column
    if ((direction < 0 ? previousInDocument : nextInDocument)(doc, block)) return false
    let row = parentBlock(doc, block)
    while (row && layoutOf(row.node) !== 'row') row = parentBlock(doc, row)
    if (!row) return false
    const pos = direction < 0 ? row.pos : row.pos + row.node.nodeSize
    if (direction < 0 ? pos <= 0 : pos >= doc.content.size) return false
    const target = Selection.findFrom(doc.resolve(pos), direction, true)
    if (!target) return false
    if (dispatch) dispatch(state.tr.setSelection(target).scrollIntoView())
    return true
  }
}

/**
 * `Tab` in a column where it can't indent (and not in code): to the bar
 * beside the column, to resize it with `←` `→`.
 */
const toBar: Command = (state, _dispatch, view) => {
  const { $from } = state.selection
  if (!view || $from.parent.type.spec.code || sinkBlocks(state)) return false
  let column = blockAround($from)
  while (column && layoutOf(column.node) !== 'column') column = parentBlock(state.doc, column)
  const row = column && parentBlock(state.doc, column)
  if (!column || !row?.group) return false
  const index = state.doc.resolve(column.pos).index()
  const bars = view.dom
    .closest('.dou-editor')
    ?.querySelectorAll<HTMLElement>('.dou-editor-columns__bar.is-key')
  const bar = bars?.[Math.min(index, row.group.childCount - 2)]
  if (!bar) return false
  bar.focus()
  return true
}

export const columnKeys = () => ({ ArrowUp: leave(-1), ArrowDown: leave(1), Tab: toBar })
