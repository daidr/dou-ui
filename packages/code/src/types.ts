import type { CodeCommand } from './core/commands'
import type { CodeKeyBinding } from './core/keymap'
import type { CodeSelection } from './core/selection'
import type { CodeText } from './core/text'
import type {
  CodeState,
  CodeTransaction,
  CodeTransactionMeta,
  CodeTransactionResult,
} from './core/transaction'

export interface CodeEditorProps {
  /** The code. `\r\n` and `\r` read as `\n`; the value handed back always uses `\n`. */
  modelValue?: string
  /** `v-model.lazy`: hand the code back only when the editor loses focus. */
  modelModifiers?: { lazy?: boolean }
  /**
   * The text as a `CodeText` (`v-model:doc`). For large files: nothing is
   * joined into one string on every key press.
   */
  doc?: CodeText
  selection?: CodeSelection
  /** Can be selected and copied, not changed. */
  readonly?: boolean
  disabled?: boolean
  /** Shows line numbers. */
  lineNumbers?: boolean
  /** Tints the line with the cursor. */
  activeLine?: boolean
  /** Columns per tab stop, also the width of one indent. */
  tabSize?: number
  /** Indents with tabs instead of spaces. */
  indentWithTabs?: boolean
  placeholder?: string
  /** Extra keys, tried before the built-in ones. */
  keymap?: CodeKeyBinding[]
  autofocus?: boolean
  ariaLabel?: string
}

export interface CodeEditorEmits {
  'update:modelValue': [value: string]
  'update:doc': [value: CodeText]
  'update:selection': [value: CodeSelection]
  /** Every change, after it is applied: typing, undo and new `v-model` values alike. `meta.action` says what made it. */
  transaction: [result: CodeTransactionResult]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}

export interface CodeEditorExpose {
  /** The text and selection now. */
  readonly state: CodeState
  readonly doc: CodeText
  readonly selection: CodeSelection
  /**
   * Makes a change: `run` adds changes to the transaction, which is applied
   * and recorded for undo as one. Positions are in the text as it was when
   * the transaction started. Returns what happened, or `null` when nothing
   * changed.
   */
  transact: (
    run: (tr: CodeTransaction) => void,
    meta?: CodeTransactionMeta,
  ) => CodeTransactionResult | null
  /** Runs a command, e.g. `selectAll`, as if its key were pressed. */
  run: (command: CodeCommand) => boolean
  undo: () => boolean
  redo: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Selects `anchor`–`head` (a cursor without `head`), or a whole selection, and scrolls it into view. */
  select: (anchor: number | CodeSelection, head?: number) => void
  /** Scrolls a position (the main cursor by default) into view. */
  scrollIntoView: (pos?: number) => void
  /** Where a position is drawn, relative to the viewport; `null` when its line isn't drawn. */
  coordsAtPos: (pos: number) => { left: number; top: number; bottom: number } | null
  /** The position nearest to a point relative to the viewport. */
  posAtCoords: (point: { x: number; y: number }) => number
  focus: () => void
  blur: () => void
}
