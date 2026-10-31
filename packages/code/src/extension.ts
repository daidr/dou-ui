import { type Component, type InjectionKey, type VNodeChild, inject } from 'vue'
import type { CodeKeyBinding } from './core/keymap'
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
 * How a part of the text is drawn. Decorations only change how the text
 * looks (colors, backgrounds, underlines, borders), never its size, so
 * the cursor still lands where the characters are.
 */
export type CodeDecoration =
  /** Classes on the characters from `from` to `to`. */
  | { type: 'mark'; from: number; to: number; class: string; title?: string }
  /** A class on a whole line (`line` from 1), e.g. a tinted background. */
  | { type: 'line'; line: number; class: string }

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
  key: string
  /** Defaults to `bottom`. */
  position?: 'top' | 'bottom'
  render: () => VNodeChild
}

export interface CodeExtension {
  name: string
  /** Higher runs first: its keys and hooks come before others. Defaults to 100. */
  priority?: number
  /** Keys tried before the built-in ones, and after the `keymap` prop. */
  keymap?: CodeKeyBinding[]
  /**
   * How parts of the text look, read while drawing: reactive state read
   * here updates them. Asked for the lines in view (`context.visible`),
   * which is all that needs them.
   */
  decorations?: (context: CodeExtensionContext) => CodeDecoration[]
  /** Columns beside the line numbers. */
  gutters?: CodeGutter[]
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
