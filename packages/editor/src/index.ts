import { withInstall } from 'dou-ui'
import Editor from './editor.vue'
import type { EditorContent } from './define-block'

export const DouEditor = withInstall(Editor)
export default DouEditor

export { useEditorContext } from './editor'
export type { EditorContext, EditorEmits, EditorExpose, EditorProps } from './editor'
export { editorLocales, useEditorMessages } from './locale'
export type { EditorMessages } from './locale'
export { filterOptions } from './catalog'
export { defineExtension, labelOf, resolveExtensions } from './core/extension'
export type {
  BlockOption,
  EditorExtension,
  ExtensionContext,
  FormatOption,
  HistoryProvider,
  Label,
  ResolvedExtensions,
} from './core/extension'
export {
  codeBlock,
  divider,
  formatting,
  heading,
  link,
  lists,
  paragraph,
  quote,
  starterKit,
} from './extensions/starter-kit'
export type { StarterKitOptions } from './extensions/starter-kit'
export { defineBlock, EditorContent, vueNodeView } from './define-block'
export { defaultLanguages } from './extensions/code-block'
export type { CodeBlockOptions, CodeHighlighter, CodeLanguage } from './extensions/code-block'
export { image, isSafeImageSrc, readAsDataUrl } from './extensions/image'
export type { ImageOptions, ImageUploader } from './extensions/image'
export type { BlockViewProps, DefineBlockOptions } from './define-block'
export { atomInputRule, blockInputRule, markInputRule } from './core/input-rules'
export type {
  Block,
  BlockProps,
  BreakContent,
  InlineContent,
  PartialBlock,
  TextContent,
} from './core/model'
export { blocksToDoc, createId, docToBlocks } from './core/model'
export type { BuiltinContentType, ContentType, MarkType } from './core/schema'
export { contentDOM, createSchema, isSafeHref, textBlock } from './core/schema'
export {
  duplicateBlocks,
  insertBlockAfter,
  liftBlocks,
  moveBlocks,
  moveRangeTo,
  setBlockType,
  sinkBlocks,
} from './core/commands'
export { clearBlockSelection, getBlockSelection, selectBlocks } from './core/block-selection'
export { isRemote } from './core/plugins'

declare module 'vue' {
  export interface GlobalComponents {
    DouEditor: typeof DouEditor
    DouEditorContent: typeof EditorContent
  }
}
