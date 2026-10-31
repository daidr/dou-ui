import { withInstall } from 'dou-ui'
import CodeEditor from './code-editor.vue'
import CodeKeys from './code-keys.vue'

export const DouCodeEditor = withInstall(CodeEditor)
export const DouCodeKeys = withInstall(CodeKeys)
export default DouCodeEditor

export type {
  CodeEditorEmits,
  CodeEditorExpose,
  CodeEditorProps,
  CodeKey,
  CodeKeysProps,
} from './types'
export { CodeText, splitLines } from './core/text'
export type { CodeLine } from './core/text'
export { ChangeSet } from './core/changes'
export type { CodeChange, CodeChangeSpec, MapAssoc } from './core/changes'
export {
  isEmptyRange,
  mainRange,
  mapSelection,
  normalizeSelection,
  rangeFrom,
  rangeTo,
  sameSelection,
  selectionOf,
} from './core/selection'
export type { CodeRange, CodeSelection } from './core/selection'
export { CodeTransaction } from './core/transaction'
export type {
  CodeAction,
  CodeState,
  CodeTransactionMeta,
  CodeTransactionResult,
} from './core/transaction'
export * as codeCommands from './core/commands'
export type { CodeCommand, CodeCommandTarget } from './core/commands'
export { defaultKeymap } from './core/keymap'
export { findPartner, matchBracket } from './core/brackets'
export type { BracketMatch } from './core/brackets'
export { CodeStream } from './language/stream'
export {
  copyPlain,
  defineCodeLanguage,
  languageFor,
  lineParts,
  samePlain,
  tokenizeLine,
  tokenTypes,
} from './language/language'
export type {
  CodeLanguage,
  CodeLanguageSpec,
  CodeLineTokens,
  CodeTokenType,
} from './language/language'
export { CodeHighlighter } from './language/highlighter'
export { createCodeHighlighter, highlightToHtml } from './language/to-html'
export { createJavaScript, javascript, jsx, tsx, typescript } from './languages/javascript'
export type { JavaScriptOptions, JavaScriptState } from './languages/javascript'
export { createCss, css, scss } from './languages/css'
export type { CssState } from './languages/css'
export { json } from './languages/json'
export type { JsonState } from './languages/json'
export { createHtml, html, vue } from './languages/html'
export type { HtmlState } from './languages/html'
export { createMarkdown, markdown } from './languages/markdown'
export type { MarkdownOptions, MarkdownState } from './languages/markdown'
export type { CodeKeyBinding } from './core/keymap'
export type { CodeSearchControl } from './core/commands'
export { matchAfter, queryRegExp, replacementFor, searchText } from './core/search'
export type { CodeMatch, CodeSearchQuery, CodeSearchResult } from './core/search'
export { codeLocales } from './locale'
export type { CodeMessages } from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouCodeEditor: typeof DouCodeEditor
    DouCodeKeys: typeof DouCodeKeys
  }
}
