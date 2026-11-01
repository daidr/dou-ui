import { withInstall } from 'dou-ui'
import Editor from './editor.vue'
import type { EditorContent } from './define-block'

export const DouEditor = withInstall(Editor)
export default DouEditor

export { useEditor } from './editor'
export type {
  EditorComments,
  EditorContext,
  EditorEmits,
  EditorExpose,
  EditorProps,
  EditorOrigin,
  EditorSelection,
  EditorTransactionResult,
} from './editor'
export { EditorTransaction } from './core/transaction'
export type {
  BlockEdge,
  BlockPatch,
  BlockPlacement,
  EditorTransactionMeta,
} from './core/transaction'
export type { BlockChanges } from './core/changes'
export type { CommentAnchor, CommentRange } from './core/comments'
export { editorLocales, useEditorMessages } from './locale'
export type { EditorMessages, EditorMessagesOverride } from './locale'
export { filterOptions } from './catalog'
export { defineEditorExtension, labelOf } from './core/extension'
export type {
  BlockOption,
  CommentsProvider,
  EditorExtension,
  EditorExtensionContext,
  FormatOption,
  HistoryProvider,
  Label,
  MountComponent,
  ResolvedEditorExtensions,
} from './core/extension'
export {
  callout,
  codeBlock,
  divider,
  formatting,
  heading,
  link,
  lists,
  paragraph,
  quote,
  editorKit,
  table,
  toggle,
} from './extensions/editor-kit'
export type { CalloutTone } from './extensions/callout'
export {
  alignColumns,
  clearCells,
  deleteColumns,
  deleteRows,
  insertColumn,
  insertRow,
  mergeCells,
  moveLines,
  moveLinesTo,
  splitMergedCell,
  toggleHeader,
} from './extensions/table'
export type { TableAlign, TableColumn } from './extensions/table'
export type { EditorKitOptions } from './extensions/editor-kit'
export { componentMounter, defineBlock, EditorContent, vueNodeView } from './define-block'
export { historyCommands } from './core/editor'
export { defaultLanguages } from './extensions/code-block'
export type { CodeBlockOptions, CodeHighlighter, CodeLanguage } from './extensions/code-block'
export { image, isSafeImageSrc, readAsDataUrl } from './extensions/image'
export { mention } from './extensions/mention'
export type { MentionItem, MentionOptions } from './extensions/mention'
export type { ImageOptions, ImageUploader } from './extensions/image'
export type { BlockViewProps, DefineBlockOptions } from './define-block'
export { atomInputRule, blockInputRule, markInputRule } from './core/input-rules'
export type {
  Block,
  BlockProps,
  BreakContent,
  EditorDocument,
  InlineContent,
  InlineNodeContent,
  PartialBlock,
  PartialTableCell,
  PartialTableRow,
  RowsSpec,
  TableCell,
  TableRow,
  TextContent,
} from './core/model'
export { blocksToDoc, createId, docToBlocks } from './core/model'
export { checkDocument, emptyDocument, migrateDocument } from './document'
export type { CheckDocumentOptions, DocumentProblem } from './document'
export type { BuiltinContentType, ContentType, MarkType } from './core/schema'
export { contentDOM, createSchema, isSafeHref, textBlock } from './core/schema'
export {
  duplicateBlocks,
  insertBlockAfter,
  liftBlocks,
  swapBlocks,
  moveRangeTo,
  setBlockType,
  sinkBlocks,
} from './core/commands'
export { clearBlockSelection, getBlockSelection, selectBlocks } from './core/block-selection'
export { isRemote } from './core/plugins'
export { blocksToHTML, htmlToBlocks } from './core/convert'
export type { EditorExtensionList } from './core/convert'
export { escapeHTML, escapeMarkdown, indentLines } from './core/output'
export type {
  BlockOutput,
  BlockOutputContext,
  EditorExtensionOutput,
  InlineOutput,
  MarkdownBlockContext,
  MarkOutput,
} from './core/output'
export { blockElement, splitContainer } from './core/prepare'

declare module 'vue' {
  export interface GlobalComponents {
    DouEditor: typeof DouEditor
    DouEditorContent: typeof EditorContent
  }
}
