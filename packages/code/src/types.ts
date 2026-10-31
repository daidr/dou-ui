import type { Component } from 'vue'
import type { CodeDiagnostic, CodeExtension } from './extension'
import type { CodeCommand } from './core/commands'
import type { CodeKeymap } from './core/keymap'
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
  /**
   * The column left of the text: line numbers, fold toggles, and the
   * problems' and extensions' markers. Off, problems are only underlined.
   * On by default.
   */
  gutter?: boolean
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
  /**
   * The bar of symbol keys above a phone's keyboard, shown on touch screens
   * while the editor can be typed in. An array sets the keys that scroll;
   * a string is a key that types itself. `false` leaves the bar out. On by default.
   */
  keys?: boolean | ReadonlyArray<CodeKey | string>
  /** Extra keys, tried before the built-in ones. */
  keymap?: CodeKeymap
  /** `Tab` indents. Off, `Tab` moves the focus on as in a form, unless a completion or snippet is in use. On by default. */
  tabIndents?: boolean
  /** Extensions: decorations, gutter columns, panels, linters and more. */
  extensions?: CodeExtension[]
  /**
   * Problems to show in the text (underlined, marked in the gutter, with
   * their fixes), for the text as it is when they are given; they move
   * with later edits until new ones come.
   */
  diagnostics?: CodeDiagnostic[]
  /**
   * Where the completion list, hover text and parameter hints render.
   * `false` (the default) keeps them inside the editor's frame; a selector
   * or element puts them above the page, for an editor too small to hold
   * them, such as `DouCodeInput`.
   */
  teleport?: string | HTMLElement | false
  autofocus?: boolean
  ariaLabel?: string
}

/** A key on the bar of symbols (`DouCodeKeys`). */
export interface CodeKey {
  /** What the key shows, or its name when it shows an icon. */
  label: string
  /** Typed when pressed, as from the keyboard: a bracket closes itself. Defaults to `label`. */
  text?: string
  /** Run when pressed, instead of typing. */
  command?: CodeCommand
  /** Drawn instead of the label. */
  icon?: Component
  /** Held down, the key goes on. */
  repeat?: boolean
  /** What screen readers read, when the label doesn't say it. */
  ariaLabel?: string
}

export interface CodeKeysProps {
  /** The editor the keys type into. */
  editor?: (Pick<CodeEditorExpose, 'run'> & Partial<Pick<CodeEditorExpose, 'focus'>>) | null
  /** The keys that scroll; a string is a key that types itself. The arrow keys at the end always stay. */
  keys?: ReadonlyArray<CodeKey | string>
  messages?: Partial<CodeMessages>
}

export interface CodeEditorEmits {
  'update:modelValue': [value: string]
  'update:doc': [value: CodeText]
  'update:selection': [value: CodeSelection]
  /** Every change, after it is applied: typing, undo and new `v-model` values alike. `meta.action` says what made it. */
  transaction: [result: CodeTransactionResult]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  /** The folds changed: the lines that start one now, from 1. Edits that move a fold to another line count too. */
  'fold-change': [lines: number[]]
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
  /** The problems found now, by all linters and the `diagnostics` prop, in text order. */
  readonly diagnostics: readonly CodeDiagnostic[]
}

export interface CodeInputProps {
  /** The code; with one line, line breaks typed or pasted become spaces. */
  modelValue?: string
  placeholder?: string
  /** Several lines: Enter breaks the line, and the box grows up to `maxRows`. */
  multiline?: boolean
  /** The most lines shown before it scrolls, with `multiline`. Defaults to 6. */
  maxRows?: number
  size?: 'sm' | 'md' | 'lg'
  invalid?: boolean
  disabled?: boolean
  readonly?: boolean
  language?: CodeLanguage | null
  extensions?: CodeExtension[]
  diagnostics?: CodeDiagnostic[]
  closeBrackets?: boolean
  tabSize?: number
  keymap?: CodeKeymap
  /** Where the completion list, hover text and parameter hints render; above the page by default. */
  teleport?: string | HTMLElement
  /** The bar of symbol keys above a phone's keyboard; off by default. */
  keys?: boolean | ReadonlyArray<CodeKey | string>
  messages?: Partial<CodeMessages>
  autofocus?: boolean
  ariaLabel?: string
}

export interface CodeInputEmits {
  'update:modelValue': [value: string]
  /** Enter on one line, or Mod + Enter on several, when no completion is open. */
  enter: []
  transaction: [result: CodeTransactionResult]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}
