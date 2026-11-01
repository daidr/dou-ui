import type { CodeExtension, CodeLanguage } from '@dou-ui/code'

/** A language in the code block's picker, with the name shown for it. */
export interface CodeEditorLanguage {
  language: CodeLanguage
  label: string
}

export interface CodeEditorBlockOptions {
  /**
   * The languages offered in the picker. A block's `language` prop is
   * matched against their names and aliases (so `bash` finds Shell); the
   * picker stores the name. Defaults to every built-in language of
   * `@dou-ui/code`.
   */
  languages?: (CodeLanguage | CodeEditorLanguage)[]
  /** Line numbers beside the code. */
  lineNumbers?: boolean
  /** Wrap long lines instead of scrolling sideways. */
  wrap?: boolean
  /** Columns per tab stop, and the indent unit. Defaults to 2. */
  tabSize?: number
  /** Extensions for every code block's editor, e.g. completions or a linter. */
  extensions?: CodeExtension[]
}

/** What the code block's view keeps for its component. */
export interface CodeEditorViewState {
  block: { id: string; props: Record<string, unknown> }
  /** The code when the editor mounts; later changes go through `transact`. */
  text: string
  editable: boolean
  selected: boolean
}

export interface CodeEditorViewOptions extends Omit<CodeEditorBlockOptions, 'languages'> {
  languages: CodeEditorLanguage[]
}
