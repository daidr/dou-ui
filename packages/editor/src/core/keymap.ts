import { chainCommands, deleteSelection, selectAll, toggleMark } from 'prosemirror-commands'
import { redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import type { Schema } from 'prosemirror-model'
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
  moveBlocks,
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

export function editorKeymap(schema: Schema, options: KeymapOptions = {}): Plugin {
  const marks = schema.marks
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

    'Mod-b': toggleMark(marks.bold!),
    'Mod-i': toggleMark(marks.italic!),
    'Mod-u': toggleMark(marks.underline!),
    'Mod-Shift-s': toggleMark(marks.strike!),
    'Mod-e': toggleMark(marks.code!),

    'Mod-Alt-0': setBlockType('paragraph'),
    'Mod-Alt-1': setBlockType('heading', { level: 1 }),
    'Mod-Alt-2': setBlockType('heading', { level: 2 }),
    'Mod-Alt-3': setBlockType('heading', { level: 3 }),
    'Mod-Shift-7': setBlockType('numberedItem'),
    'Mod-Shift-8': setBlockType('bulletItem'),
    'Mod-Shift-9': setBlockType('checkItem'),

    'Mod-d': duplicateBlocks,
    'Mod-Shift-ArrowUp': moveBlocks(-1),
    'Mod-Shift-ArrowDown': moveBlocks(1),
  })
}
