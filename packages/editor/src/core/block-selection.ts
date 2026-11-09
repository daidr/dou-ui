import { keydownHandler } from 'prosemirror-keymap'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import {
  blocksIn,
  findBlockById,
  layoutOf,
  parentBlock,
  selectedRange,
  siblingRangeBetween,
  type BlockInfo,
  type SiblingRange,
} from './blocks'
import { duplicateBlocks, liftBlocks, swapBlocks, deleteBlocks, sinkBlocks } from './commands'

/**
 * Whole blocks selected with `Esc` or from the block handle. The selected
 * blocks are siblings, from `anchor` to `head`. Underneath, the editor's
 * own selection spans their text, so copy and cut work as usual; the text
 * highlight is hidden and the blocks are tinted instead.
 */
export interface BlockSelection {
  anchor: string
  head: string
}

export const blockSelectionKey = new PluginKey<BlockSelection | null>('dou-editor-block-selection')

export function getBlockSelection(state: EditorState): BlockSelection | null {
  return blockSelectionKey.getState(state) ?? null
}

/** The blocks of a block selection, or `null` when they can't be found. */
export function blockSelectionRange(state: EditorState): SiblingRange | null {
  const current = getBlockSelection(state)
  if (!current) return null
  const anchor = findBlockById(state.doc, current.anchor)
  const head = findBlockById(state.doc, current.head)
  if (!anchor || !head) return null
  const [first, last] = anchor.pos <= head.pos ? [anchor, head] : [head, anchor]
  const range = siblingRangeBetween(state.doc, first.pos + 1, last.pos + 1)
  return range && range.depth === anchor.depth ? range : null
}

/** Put the editor's own selection over the text of the selected blocks. */
function spanSelection(tr: Transaction, range: SiblingRange) {
  const blocks = blocksIn(range)
  const first = blocks[0]!
  const last = blocks.at(-1)!
  const $from = tr.doc.resolve(first.contentPos + 1)
  const $to = tr.doc.resolve(last.pos + last.node.nodeSize - 1)
  tr.setSelection(TextSelection.between($from, $to))
}

/** Select whole blocks, from `anchor` to `head` (siblings). */
export function selectBlocks(anchor: string, head = anchor): Command {
  return (state, dispatch) => {
    const tr = state.tr.setMeta(blockSelectionKey, { anchor, head })
    const preview = state.apply(tr)
    const range = blockSelectionRange(preview)
    if (!range) return false
    if (dispatch) {
      spanSelection(tr, range)
      tr.setMeta(blockSelectionKey, { anchor, head })
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export const clearBlockSelection: Command = (state, dispatch) => {
  if (!getBlockSelection(state)) return false
  if (dispatch) dispatch(state.tr.setMeta(blockSelectionKey, null))
  return true
}

/** `Esc`: select the blocks the cursor or text selection is in. */
export const selectCurrentBlocks: Command = (state, dispatch) => {
  if (getBlockSelection(state)) return false
  const range = selectedRange(state)
  if (!range) return false
  const blocks = blocksIn(range)
  return selectBlocks(blocks[0]!.node.attrs.id, blocks.at(-1)!.node.attrs.id)(state, dispatch)
}

/** Leave the block selection with the cursor at the end of a block. */
function placeCursor(view: EditorView, block: BlockInfo, atEnd = true) {
  const tr = view.state.tr.setMeta(blockSelectionKey, null)
  const pos = atEnd ? block.contentPos + block.content.nodeSize - 1 : block.contentPos + 1
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos), atEnd ? -1 : 1))
  view.dispatch(tr.scrollIntoView())
}

function moveHead(view: EditorView, direction: -1 | 1, extend: boolean) {
  const state = view.state
  const current = getBlockSelection(state)!
  const range = blockSelectionRange(state)
  if (!range) return false
  const head = findBlockById(state.doc, current.head)!
  const $head = state.doc.resolve(head.pos)
  const index = $head.index() + direction
  if (index < 0 || index >= range.parent.childCount) {
    // past the edge of a column: the whole set of columns
    const column = parentBlock(state.doc, head)
    const row = column && layoutOf(column.node) === 'column' && parentBlock(state.doc, column)
    if (row) selectBlocks(row.node.attrs.id as string)(state, view.dispatch)
    return true
  }
  const id = range.parent.child(index).attrs.id as string
  return selectBlocks(extend ? current.anchor : id, id)(state, view.dispatch)
}

/** Run a block command, then select the same blocks again. */
function keepSelected(command: Command): (view: EditorView) => boolean {
  return (view) => {
    const current = getBlockSelection(view.state)
    if (!current || !command(view.state, view.dispatch)) return false
    selectBlocks(current.anchor, current.head)(view.state, view.dispatch)
    return true
  }
}

const removeSelected = (view: EditorView) => {
  const range = blockSelectionRange(view.state)
  if (!range) return false
  const tr = deleteBlocks(view.state.tr, blocksIn(range)).setMeta(blockSelectionKey, null)
  view.dispatch(tr.scrollIntoView())
  return true
}

const blockKeys = keydownHandler({
  ArrowUp: (_state, _dispatch, view) => moveHead(view!, -1, false),
  ArrowDown: (_state, _dispatch, view) => moveHead(view!, 1, false),
  'Shift-ArrowUp': (_state, _dispatch, view) => moveHead(view!, -1, true),
  'Shift-ArrowDown': (_state, _dispatch, view) => moveHead(view!, 1, true),
  Backspace: (_state, _dispatch, view) => removeSelected(view!),
  Delete: (_state, _dispatch, view) => removeSelected(view!),
  'Mod-d': (_state, _dispatch, view) => keepSelected(duplicateBlocks)(view!),
  'Mod-Shift-ArrowUp': (_state, _dispatch, view) => keepSelected(swapBlocks(-1))(view!),
  'Mod-Shift-ArrowDown': (_state, _dispatch, view) => keepSelected(swapBlocks(1))(view!),
  Tab: (_state, _dispatch, view) => keepSelected(sinkBlocks)(view!),
  'Shift-Tab': (_state, _dispatch, view) => keepSelected(liftBlocks)(view!),
  Escape: (state, dispatch) => clearBlockSelection(state, dispatch),
  Enter: (state, _dispatch, view) => {
    const current = getBlockSelection(state)!
    const head = findBlockById(state.doc, current.head)
    if (head) placeCursor(view!, head)
    return true
  },
})

export function blockSelectionPlugin(): Plugin<BlockSelection | null> {
  return new Plugin<BlockSelection | null>({
    key: blockSelectionKey,
    state: {
      init: () => null,
      apply(tr, value) {
        const meta = tr.getMeta(blockSelectionKey) as BlockSelection | null | undefined
        if (meta !== undefined) return meta
        // any other selection change (a click, typing) ends it
        if (value && tr.selectionSet && !tr.docChanged) return null
        return value
      },
    },
    props: {
      decorations(state) {
        const range = blockSelectionRange(state)
        if (!range) return null
        return DecorationSet.create(
          state.doc,
          blocksIn(range).map((block) =>
            Decoration.node(block.pos, block.pos + block.node.nodeSize, { class: 'is-selected' }),
          ),
        )
      },
      attributes(state): Record<string, string> {
        return getBlockSelection(state) ? { class: 'is-block-selecting' } : {}
      },
      handleKeyDown(view, event) {
        const current = getBlockSelection(view.state)
        if (!current) return false
        if (blockKeys(view, event)) return true
        // typing a character: back to text editing at the end of the head block
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const head = findBlockById(view.state.doc, current.head)
          if (head) placeCursor(view, head)
          return false
        }
        return false
      },
    },
  })
}
