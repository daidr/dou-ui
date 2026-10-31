import type { CodeCommand } from './core/commands'
import type { CodeKeyBinding } from './core/keymap'
import type { CodeSearchQuery } from './core/search'
import type { CodeSelection } from './core/selection'
import type { CodeMessages } from './locale'
import type { CodeLanguage } from './language/language'
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
  /** The language: colors its tokens, and tells how to indent, comment and pair brackets. */
  language?: CodeLanguage | null
  /** Typing an opening bracket or quote also types its partner. On by default. */
  closeBrackets?: boolean
  /** Outlines the bracket next to the cursor and its partner. On by default. */
  matchBrackets?: boolean
  /** The built-in search panel (Mod+F). On by default. */
  searchable?: boolean
  /** Wraps long lines at the editor's width instead of scrolling sideways. */
  wrap?: boolean
  /** Shows fold toggles beside the line numbers, and lets blocks be folded. On by default. */
  foldable?: boolean
  /** Replaces any of the editor's texts, which otherwise follow DouUI's locale. */
  messages?: Partial<CodeMessages>
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
  /** Opens the search panel, filled with `query` or else the selected text. */
  openSearch: (query?: Partial<CodeSearchQuery>) => void
  /** Closes the search panel; `false` when it wasn't open. */
  closeSearch: () => boolean
  /** Folds the block starting at a line (from 1), or the one around the cursor; `false` when there is none. */
  fold: (line?: number) => boolean
  /** Unfolds the folds that start at or hide a line, or the cursor's line. */
  unfold: (line?: number) => boolean
  /** Folds every outermost block. */
  foldAll: () => boolean
  /** Unfolds everything. */
  unfoldAll: () => boolean
  /** The lines that start a fold now, from 1. */
  readonly folds: number[]
}
