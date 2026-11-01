import type { EditorState } from 'prosemirror-state'
import { blockAround, blocksIn, selectedRange } from './blocks'
import { blockSelectionRange } from './block-selection'

/** Where the selection is, by block. */
export interface BlockSelectionInfo {
  block: string | null
  blocks: string[]
}

export function selectionOf(state: EditorState): BlockSelectionInfo {
  const range = blockSelectionRange(state) ?? selectedRange(state)
  const head = blockAround(state.selection.$head)
  return {
    block: (head?.node.attrs.id as string | undefined) ?? null,
    blocks: range ? blocksIn(range).map((info) => info.node.attrs.id as string) : [],
  }
}

export function sameSelection(a: BlockSelectionInfo, b: BlockSelectionInfo): boolean {
  return (
    a.block === b.block &&
    a.blocks.length === b.blocks.length &&
    a.blocks.every((id, i) => b.blocks[i] === id)
  )
}
