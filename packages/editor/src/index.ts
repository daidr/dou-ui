import { withInstall } from 'dou-ui'
import Editor from './editor.vue'

export const DouEditor = withInstall(Editor)
export default DouEditor

export type { EditorContext, EditorEmits, EditorExpose, EditorProps } from './editor'
export { editorLocales, useEditorMessages } from './locale'
export type { EditorMessages } from './locale'
export { blockOptions, filterOptions } from './catalog'
export type { BlockOption } from './catalog'
export type {
  Block,
  BlockProps,
  BreakContent,
  InlineContent,
  PartialBlock,
  TextContent,
} from './core/model'
export { blocksToDoc, createId, docToBlocks } from './core/model'
export type { ContentType, MarkType } from './core/schema'
export { isSafeHref, schema } from './core/schema'
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
  }
}
