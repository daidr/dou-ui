import { withInstall } from 'dou-ui'
import CodeEditor from './code-editor.vue'

export const DouCodeEditor = withInstall(CodeEditor)
export default DouCodeEditor

export type { CodeEditorEmits, CodeEditorExpose, CodeEditorProps } from './types'
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
export type { CodeKeyBinding } from './core/keymap'

declare module 'vue' {
  export interface GlobalComponents {
    DouCodeEditor: typeof DouCodeEditor
  }
}
