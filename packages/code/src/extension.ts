import { type Component, type InjectionKey, type VNodeChild, inject } from 'vue'
import type { CodeKeymap } from './core/keymap'
import type { CodeSelection } from './core/selection'
import type { CodeText } from './core/text'
import type { CodeState, CodeTransaction } from './core/transaction'
import type { CodeEditorExpose } from './types'

/** How bad a diagnostic is, worst first. */
export type CodeDiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

/** A fix offered with a diagnostic. */
export interface CodeDiagnosticAction {
  label: string
  /** Makes the fix, usually with `context.transact`. */
  run: (context: CodeExtensionContext, diagnostic: CodeDiagnostic) => void
}

/**
 * A problem found in the text, from `from` to `to` (offsets in the text,
 * the same as a language service's ranges). An empty range marks the
 * character after it.
 */
export interface CodeDiagnostic {
  from: number
  to: number
  severity: CodeDiagnosticSeverity
  message: string
  /** Who found it, shown after the message, e.g. the name of a linter. */
  source?: string
  /** Fixes, shown under the message and with `Mod` + `.`. */
  actions?: CodeDiagnosticAction[]
}

/**
 * How a part of the text is drawn. Marks and line classes only change how
 * the text looks (colors, backgrounds, underlines, borders), never its
 * size, so the cursor still lands where the characters are; an inline
 * widget takes its own room in the line.
 */
export type CodeDecoration =
  /** Classes on the characters from `from` to `to`. */
  | { type: 'mark'; from: number; to: number; class: string; title?: string }
  /** A class on a whole line (`line` from 1), e.g. a tinted background. */
  | { type: 'line'; line: number; class: string }
  /**
   * Something drawn inside a line, before the character at `pos`, such as
   * a color swatch or a parameter's name. It isn't text: the cursor steps
   * over it and copying leaves it out. `width` in px saves measuring it;
   * without it the widget is measured once drawn, and the width is kept by
   * `id`.
   */
  | { type: 'inline'; pos: number; render: () => VNodeChild; width?: number; id?: string }

/**
 * A component drawn between lines, across the editor, e.g. a review
 * comment. The lines below move down to make room, and it moves with the
 * text as lines are added or removed above it.
 */
export interface CodeWidget {
  /** Tells widgets apart, unique among one extension's; its measured height is kept by it. */
  id: string
  /**
   * Where it is: below the line of text position `pos`, or below line
   * `line` (from 1); above with `position: 'above'`. Give one of them.
   */
  pos?: number
  line?: number
  /** Defaults to `below`. */
  position?: 'above' | 'below'
  render: () => VNodeChild
  /** Its height in px before it has been drawn and measured; defaults to one line. */
  height?: number
  /** What it is, read out when the cursor moves onto its line, e.g. "戴兜的评论". */
  label?: string
}

/** Something drawn in a column beside the line numbers, on line `line` (from 1). */
export interface CodeGutterMarker {
  line: number
  /** Drawn in the middle of the column. */
  icon?: Component
  /** Short text, when there is no icon. */
  text?: string
  class?: string
  /** Shown on hover and read out. */
  title?: string
}

/** A column of the gutter, left of the line numbers. */
export interface CodeGutter {
  name: string
  /** In px. Defaults to 16. */
  width?: number
  /** The markers on the lines in view; reactive state read here updates them. */
  markers: (context: CodeExtensionContext) => CodeGutterMarker[]
  /** A press on the column, on line `line`, e.g. to set a breakpoint. */
  onPress?: (line: number, event: PointerEvent, context: CodeExtensionContext) => void
}

/** A bar above or below the text, inside the editor's frame. */
export interface CodePanel {
  /** Tells panels apart, unique among one extension's. */
  name: string
  /** Defaults to `bottom`. */
  position?: 'top' | 'bottom'
  render: () => VNodeChild
}

/** What a completion is, shown as its icon. */
export type CodeCompletionKind =
  | 'keyword'
  | 'function'
  | 'method'
  | 'variable'
  | 'property'
  | 'constant'
  | 'class'
  | 'type'
  | 'module'
  | 'snippet'
  | 'text'

/** One entry of the completion list. */
export interface CodeCompletion {
  /** Shown, and matched against what was typed. */
  label: string
  kind?: CodeCompletionKind
  /** Short, after the label, e.g. a type. */
  detail?: string
  /** Longer, beside the list while this entry is picked. */
  info?: string
  /** What goes into the text, if not the label. */
  insert?: string
  /** Inserted as a snippet instead: `${1:name}` places to fill in, Tab to the next, `$0` where it ends. */
  snippet?: string
  /** Moves the entry up (positive) or down among equally good matches. */
  boost?: number
}

/** What a completion source is asked with. */
export interface CodeCompletionRequest {
  /** The cursor. */
  pos: number
  /** The word right before the cursor, by the language's word characters; empty when there is none. */
  word: { from: number; to: number; text: string }
  /** Asked for from the keyboard (`Ctrl` + `Space`, `Alt` + `Esc`) rather than by typing. */
  explicit: boolean
  /** Aborted when the answer is no longer wanted, so a slow source can stop. */
  signal: AbortSignal
}

/** What a hover or signature source is asked with. */
export interface CodePositionRequest {
  /** The position asked about: under the pointer, or the cursor. */
  pos: number
  /** Aborted when the answer is no longer wanted, so a slow source can stop. */
  signal: AbortSignal
}

/** What a completion source answers: entries to put in place of `from`–cursor. */
export interface CodeCompletionResult {
  from: number
  options: CodeCompletion[]
}

/** Text shown on hover, or with the cursor on it from the keyboard. */
export interface CodeHoverResult {
  /** What it is about, `from`–`to`; defaults to the word under the pointer. */
  from?: number
  to?: number
  /** Plain text, or a render function for anything else. */
  content: string | (() => VNodeChild)
}

/** The parameters of the call the cursor is in. */
export interface CodeSignatureResult {
  /** The whole signature, e.g. `slice(start, end)`. */
  label: string
  /** Each parameter as `[from, to]` in `label`. */
  params: Array<[number, number]>
  /** Which parameter the cursor is at, from 0. */
  active: number
  info?: string
}

export interface CodeExtension {
  name: string
  /** Higher runs first: its keys and hooks come before others. Defaults to 100. */
  priority?: number
  /** Keys tried before the built-in ones, and after the `keymap` prop. */
  keymap?: (context: CodeExtensionContext) => CodeKeymap
  /**
   * How parts of the text look, read while drawing: reactive state read
   * here updates them. Asked for the lines in view (`context.visible`),
   * which is all that needs them.
   */
  decorations?: (context: CodeExtensionContext) => CodeDecoration[]
  /** Columns beside the line numbers. */
  gutters?: CodeGutter[]
  /**
   * Components between lines. Unlike decorations, these are asked for the
   * whole text, since their heights place every line after them; keep
   * them few (comments, not one per line).
   */
  widgets?: (context: CodeExtensionContext) => CodeWidget[]
  /**
   * Lines left out of view, from `from` to `to` (from 1, both kept out),
   * e.g. the unchanged lines of a diff. Unlike a fold, nothing marks the
   * spot; put a widget there for that. Asked for the whole text; reactive
   * state read here updates them. Moving up and down steps over them.
   */
  hide?: (context: CodeExtensionContext) => Array<{ from: number; to: number }>
  /** Bars above or below the text; reactive state read here updates them. */
  panels?: (context: CodeExtensionContext) => CodePanel[]
  /**
   * Finds problems in the text. Run when the editor mounts and again a
   * moment after the text stops changing; an answer that arrives after
   * the text changed again is dropped, and the next run follows it.
   * Meanwhile the problems found move with the text.
   */
  lint?: (
    context: CodeExtensionContext,
  ) => CodeDiagnostic[] | null | undefined | Promise<CodeDiagnostic[] | null | undefined>
  /**
   * Offers completions while typing (after a word character or one of
   * `completionTriggers`) and on `Ctrl` + `Space` or `Alt` + `Esc`. Answers from every
   * extension are put in one list; a Promise is waited for, and dropped
   * when the text has moved on.
   */
  completion?: (
    request: CodeCompletionRequest,
    context: CodeExtensionContext,
  ) => CodeCompletionResult | null | undefined | Promise<CodeCompletionResult | null | undefined>
  /** Characters that ask for completions when typed, such as `.`. */
  completionTriggers?: string[]
  /**
   * Text about a position, shown on hover and with `Mod` + `I`. A Promise
   * is waited for; `signal` aborts when the pointer moves on.
   */
  hover?: (
    request: CodePositionRequest,
    context: CodeExtensionContext,
  ) => CodeHoverResult | null | undefined | Promise<CodeHoverResult | null | undefined>
  /**
   * The parameters of the call around the cursor, shown while typing its
   * arguments. A Promise is waited for, and dropped when the cursor has
   * moved on.
   */
  signature?: (
    request: CodePositionRequest,
    context: CodeExtensionContext,
  ) => CodeSignatureResult | null | undefined | Promise<CodeSignatureResult | null | undefined>
  /**
   * Sees every change before it is applied, in priority order, and may add
   * to it (positions are in the text before the change). Undo, redo and new
   * `v-model` values don't come through here.
   */
  transaction?: (tr: CodeTransaction, context: CodeExtensionContext) => void
  /** Runs once the editor is mounted. Return a function to run when it unmounts. */
  setup?: (context: CodeExtensionContext) => void | (() => void)
}

/** What an extension sees of the editor: its instance, plus a little more. */
export interface CodeExtensionContext extends CodeEditorExpose {
  /** The text and selection now; reading them in `decorations` or `panels` follows every change. */
  readonly state: CodeState
  readonly doc: CodeText
  readonly selection: CodeSelection
  /** The lines in view, from 1. */
  readonly visible: { readonly from: number; readonly to: number }
  /** The problems found now, by all linters and the `diagnostics` prop, in text order. */
  readonly diagnostics: readonly CodeDiagnostic[]
  /** Reads a message out to screen readers. */
  announce: (message: string) => void
}

/** Types an extension; returns it as it is. */
export function defineCodeExtension(extension: CodeExtension): CodeExtension {
  return extension
}

export const CODE_EDITOR_KEY: InjectionKey<CodeExtensionContext> = Symbol('DouCodeEditor')

/** The editor a panel or gutter component is drawn in. */
export function useCodeEditor(): CodeExtensionContext {
  const context = inject(CODE_EDITOR_KEY, null)
  if (!context) throw new Error('useCodeEditor() must be called inside a DouCodeEditor')
  return context
}
