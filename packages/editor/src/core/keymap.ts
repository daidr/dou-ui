import { chainCommands, deleteSelection, selectAll } from 'prosemirror-commands'
import { redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import type { Command, Plugin } from 'prosemirror-state'
import { selectCurrentBlocks } from './block-selection'
import {
  deleteSelectedAtom,
  duplicateBlocks,
  exitCode,
  insertBreak,
  joinBackward,
  joinForward,
  liftBlocks,
  swapBlocks,
  newlineInCode,
  setBlockType,
  sinkBlocks,
  splitBlock,
} from './commands'

export interface KeymapOptions {
  /** Undo and redo; the collaboration extension swaps in its own. */
  undo?: Command
  redo?: Command
}

/** Two spaces in code; elsewhere `Tab` indents the block. */
const indentCode: Command = (state, dispatch) => {
  if (!state.selection.$from.parent.type.spec.code) return false
  if (dispatch) dispatch(state.tr.insertText('  '))
  return true
}

/** The keys every editor has; marks and block types bring their own. */
export function editorKeymap(options: KeymapOptions = {}): Plugin {
  const undoCommand = options.undo ?? undo
  const redoCommand = options.redo ?? redo
  return keymap({
    Enter: chainCommands(newlineInCode, splitBlock),
    'Shift-Enter': insertBreak,
    'Mod-Enter': exitCode,
    Backspace: chainCommands(deleteSelectedAtom, deleteSelection, joinBackward),
    Delete: chainCommands(deleteSelectedAtom, deleteSelection, joinForward),
    // when nothing can be indented, Tab moves focus on as usual
    Tab: chainCommands(indentCode, sinkBlocks),
    'Shift-Tab': liftBlocks,
    Escape: selectCurrentBlocks,
    'Mod-a': selectAll,

    'Mod-z': undoCommand,
    'Mod-Shift-z': redoCommand,
    'Mod-y': redoCommand,

    'Mod-Alt-0': setBlockType('paragraph'),

    'Mod-d': duplicateBlocks,
    'Mod-Shift-ArrowUp': swapBlocks(-1),
    'Mod-Shift-ArrowDown': swapBlocks(1),
  })
}
