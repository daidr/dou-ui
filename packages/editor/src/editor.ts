import type { EditorState, Command, Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { inject, type ComputedRef, type InjectionKey, type ShallowRef } from 'vue'
import type { EditorExtension, ResolvedEditorExtensions } from './core/extension'
import type { BlockChanges } from './core/changes'
import type { Block, PartialBlock } from './core/model'
import type {
  BlockEdge,
  BlockPatch,
  BlockPlacement,
  EditorTransaction,
  EditorTransactionMeta,
} from './core/transaction'
import type { EditorMessages, EditorMessagesOverride } from './locale'

export interface EditorProps {
  /**
   * The document as a list of blocks, bound with `v-model`. With
   * collaboration the shared document is the source of truth: leave
   * `v-model` out and read changes from the `change` event.
   */
  modelValue?: PartialBlock[]
  /**
   * Blocks, marks, shortcuts and menu entries. Defaults to `[editorKit()]`;
   * read once, when the editor mounts.
   */
  extensions?: (EditorExtension | EditorExtension[])[]
  /** Show the document without editing it. Links stay clickable. */
  readonly?: boolean
  /** The hint in the empty block under the cursor. */
  placeholder?: string
  /** Replace any of the built-in texts. */
  messages?: EditorMessagesOverride
  /** The accessible name of the editing area. */
  ariaLabel?: string
  /** Focus the editor once it is mounted. */
  autofocus?: boolean
  /**
   * Extra ProseMirror plugins, e.g. for collaboration. They run before
   * the built-in ones, so their keys win.
   */
  plugins?: Plugin[]
  /** Leave out the built-in undo history (collaboration brings its own). */
  history?: boolean
  /** Undo and redo commands to replace the built-in ones. */
  undo?: Command
  redo?: Command
  /**
   * The block with the cursor and the selected blocks, bound with
   * `v-model:selection`. Setting it puts the cursor at the end of `block`,
   * or selects `blocks` when there are several siblings, without focusing.
   */
  selection?: EditorSelection
}

/**
 * Who made a change: `'external'` for a new `v-model` value or
 * `setBlocks`, `'remote'` for a collaborator's, `'undo'` and `'redo'`, or
 * the `origin` given to `transact`. Typing and the editor's own commands
 * leave it out.
 */
export type EditorOrigin = 'external' | 'remote' | 'undo' | 'redo' | (string & {})

/** What a change to the document did, as the `transaction` event hands it over. */
export interface EditorTransactionResult {
  /** The document after the change, as `update:modelValue` gets it next. */
  blocks: Block[]
  /** The blocks the change touched, by id. */
  changes: BlockChanges
  meta: {
    origin?: EditorOrigin
    /** Whether undo can take the change back: not for others' changes, nor for undo and redo themselves. */
    history: boolean
  }
}

/** Where the selection is, by block. */
export interface EditorSelection {
  /** The innermost block at the cursor (the moving end of a selection); `null` while none is. */
  block: string | null
  /**
   * The blocks the selection covers: the selected blocks, or the blocks a
   * text selection runs across, at the level they share.
   */
  blocks: string[]
}

export interface EditorEmits {
  'update:modelValue': [blocks: Block[]]
  /** The document changed: typing, formatting, moving blocks. */
  change: [blocks: Block[]]
  /** Every change to the document, with what it touched; `update:modelValue` follows. */
  transaction: [result: EditorTransactionResult]
  /** The cursor moved to another block, or other blocks were selected. */
  'update:selection': [selection: EditorSelection]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}

export interface EditorExpose {
  /** The ProseMirror view, once mounted. */
  readonly view: EditorView | null
  focus: () => void
  blur: () => void
  /** The current document. */
  getBlocks: () => Block[]
  /** Replace the document. The change does not go into the undo history. */
  setBlocks: (blocks: PartialBlock[]) => void
  /** The current document as HTML, written by the extensions (see `blocksToHTML`). */
  getHTML: () => string
  /** Replace the document with HTML, read like pasted HTML. */
  setHTML: (html: string) => void
  /** Run a ProseMirror command, e.g. one of the exported ones. */
  run: (command: Command) => boolean
  /**
   * Make changes by blocks and ids, applied together as one undo step.
   * Returns what happened, or `null` when nothing changed. Works while
   * read-only too.
   */
  transact: (
    fn: (tr: EditorTransaction) => void,
    meta?: EditorTransactionMeta,
  ) => EditorTransactionResult | null
  /** One block, or `null` when there is none with that id. */
  getBlock: (id: string) => Block | null
  /**
   * Insert blocks, by default after the block with the cursor. Returns the
   * new blocks' ids (an id already in use is replaced). One undo step.
   */
  insertBlocks: (blocks: PartialBlock[], placement?: BlockPlacement) => string[]
  /** Change a block's type, props (merged), content or children. One undo step. */
  updateBlock: (id: string, patch: BlockPatch) => boolean
  /** Remove blocks with their children. One undo step. */
  removeBlocks: (ids: string[]) => boolean
  /** Move blocks, in the order given, before, after or into another block. One undo step. */
  moveBlocks: (ids: string[], placement: BlockPlacement) => boolean
  /** Focus the editor with the cursor at the start or end (the default) of a block, scrolled into view. */
  focusBlock: (id: string, edge?: BlockEdge) => boolean
  /** The selection by block, as `v-model:selection` has it. */
  getSelection: () => EditorSelection
  undo: () => boolean
  redo: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
}

/** What the parts around the editing area (menus, handle, toolbar) share. */
export interface EditorContext {
  view: ShallowRef<EditorView | null>
  /** Updated on every transaction, so computeds follow the selection too. */
  state: ShallowRef<EditorState | null>
  focused: ShallowRef<boolean>
  /** Blocks are being dragged by the handle. */
  dragging: ShallowRef<boolean>
  editable: ComputedRef<boolean>
  messages: ComputedRef<EditorMessages>
  /** What the extensions contribute: schema, menu entries, toolbar toggles. */
  kit: ResolvedEditorExtensions
  /** The element the overlays are positioned against. */
  root: ShallowRef<HTMLElement | null>
}

export const editorKey: InjectionKey<EditorContext> = Symbol('DouEditor')

/** The editor around a block component, for its messages, state and view. */
export function useEditor(): EditorContext {
  const context = inject(editorKey, null)
  if (!context) throw new Error('[@dou-ui/editor] useEditor() is only available inside the editor')
  return context
}
