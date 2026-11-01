import type { Command, EditorState } from 'prosemirror-state'
import type { BlockAlign } from '../../core/align'
import { blockSelectionRange } from '../../core/block-selection'
import { blocksIn, findBlockById, selectedRange } from '../../core/blocks'

/** Whether a content node can be aligned. */
const alignable = (state: EditorState, name: string) =>
  !!state.schema.nodes[name]?.spec.attrs?.align

/**
 * Align the selected blocks (or the block with `id`). `'left'` and `null`
 * both go back to the reading direction, stored as no `align` at all.
 * Blocks that can't be aligned are left alone.
 */
export function setAlign(align: BlockAlign | null, id?: string): Command {
  const value = align === 'left' ? null : align
  return (state, dispatch) => {
    const blocks = id
      ? [findBlockById(state.doc, id)].filter((info) => !!info)
      : (() => {
          const range = blockSelectionRange(state) ?? selectedRange(state)
          return range ? blocksIn(range) : []
        })()
    const targets = blocks.filter((info) => alignable(state, info.content.type.name))
    if (!targets.length) return false
    if (dispatch) {
      const tr = state.tr
      for (const info of targets) tr.setNodeAttribute(info.contentPos, 'align', value)
      dispatch(tr)
    }
    return true
  }
}

/**
 * The alignment the selected blocks share: `null` for none set, `'mixed'`
 * when they differ, `undefined` when none can be aligned.
 */
export function currentAlign(state: EditorState): BlockAlign | 'mixed' | null | undefined {
  const range = blockSelectionRange(state) ?? selectedRange(state)
  const blocks = range
    ? blocksIn(range).filter((info) => alignable(state, info.content.type.name))
    : []
  if (!blocks.length) return undefined
  const first = (blocks[0]!.content.attrs.align as BlockAlign | null) ?? null
  return blocks.every((info) => (info.content.attrs.align ?? null) === first) ? first : 'mixed'
}
