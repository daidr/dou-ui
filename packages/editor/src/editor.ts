import type { EditorState, Command, Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { CommentAction, CommentAuthor, CommentThread } from 'dou-ui'
import {
  inject,
  onBeforeUnmount,
  provide,
  shallowReactive,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue'
import type { CommentAnchor, CommentRange } from './core/comments'
import type { EditorExtension, ResolvedEditorExtensions } from './core/extension'
import type { BlockChanges } from './core/changes'
import type { Block, EditorDocument, PartialBlock } from './core/model'
import type { EditorSearchQuery } from './core/search'
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
   * The document, bound with `v-model`. With collaboration the shared
   * document is the source of truth: leave `v-model` out and read changes
   * from the `change` event.
   */
  modelValue?: EditorDocument<PartialBlock>
  /**
   * Blocks, marks, shortcuts and menu entries. Defaults to `[editorKit()]`;
   * read once, when the editor mounts.
   */
  extensions?: (EditorExtension | EditorExtension[])[]
  /** Show the document without editing it. Links stay clickable. */
  readonly?: boolean
  /** The built-in find panel (`Ctrl/⌘+F`). Off, the keys are left to the browser. On by default. */
  searchable?: boolean
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
   * The comment threads, bound with `v-model:comments`. The text a thread
   * is about carries its id in the document; leave this out to turn
   * comments off.
   */
  comments?: CommentThread[]
  /** Who is commenting. Without it comments can be read but not written. */
  author?: CommentAuthor
  /** The id of the thread shown beside its text, bound with `v-model:activeComment`. */
  activeComment?: string | null
  /** Whether threads can be started and answered; also while `readonly`. Defaults to `true`. */
  commentable?: boolean
  /**
   * An older version of the document, e.g. one the app saved. The editor
   * then shows the document read-only, with what changed since marked:
   * blocks added and removed, and in each changed block the text added
   * and removed. Blocks are matched by `id`; a block without one shows as
   * removed.
   */
  compare?: EditorDocument<PartialBlock> | null
  /**
   * The block with the cursor and the selected blocks, bound with
   * `v-model:selection`. Setting it puts the cursor at the end of `block`,
   * or selects `blocks` when there are several siblings, without focusing.
   */
  selection?: EditorSelection
}

/**
 * Who made a change: `'external'` for a new `v-model` value or
 * `setBlocks`, `'remote'` for a collaborator's, `'restore'` for `restore`,
 * `'undo'` and `'redo'`, or
 * the `origin` given to `transact`. Typing and the editor's own commands
 * leave it out.
 */
export type EditorOrigin = 'external' | 'remote' | 'restore' | 'undo' | 'redo' | (string & {})

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
  'update:modelValue': [document: EditorDocument]
  /** The document changed: typing, formatting, moving blocks. */
  change: [document: EditorDocument]
  /** Every change to the document, with what it touched; `update:modelValue` follows. */
  transaction: [result: EditorTransactionResult]
  /** The cursor moved to another block, or other blocks were selected. */
  'update:selection': [selection: EditorSelection]
  /** Before a link opens (Ctrl / ⌘ + click, or a click while read-only); `preventDefault()` keeps it from opening in a new tab. */
  linkOpen: [event: EditorLinkOpenEvent]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  'update:comments': [threads: CommentThread[]]
  'update:activeComment': [id: string | null]
  /** A change to the comments made here: to send to a server, notify people, keep a log. */
  commentAction: [action: CommentAction]
}

/**
 * Before a link is followed. `preventDefault()` stops the editor from
 * opening it in a new tab, e.g. to use the app's router or ask first.
 */
export interface EditorLinkOpenEvent {
  /** The address as the text's `link` holds it. */
  link: string
  /** The id of the block the link is in. */
  block: string
  defaultPrevented: boolean
  preventDefault: () => void
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
   * Opens the find panel (`Ctrl/⌘+F`), with a query put in; with `replace`
   * in it, the replace box opens too. `false` when `searchable` is off or
   * the editor is not mounted.
   */
  openSearch: (query?: Partial<EditorSearchQuery>) => boolean
  /** Closes the find panel; `false` when it was not open. */
  closeSearch: () => boolean
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
  /**
   * Start a thread on the selected text and open the box for its first
   * comment; with the cursor on commented text, open that thread to reply.
   */
  comment: () => boolean
  /** Where each thread is anchored; `null` for a thread whose text was deleted. */
  getCommentAnchors: () => Record<string, CommentAnchor | null>
  /**
   * Replace the document with `doc`, e.g. an older version, as one
   * change undo takes back. With collaboration only the blocks that differ
   * are written, and everyone sees it. The `transaction` event has origin
   * `'restore'`. Like the other methods it works while `readonly`; it is
   * the one change allowed while comparing. Returns `false` when nothing
   * differs.
   */
  restore: (doc: EditorDocument<PartialBlock>) => boolean
  /** With `compare`: scroll to the next change after the one last shown; `false` when there is none. */
  nextChange: () => boolean
  /** With `compare`: scroll to the change before the one last shown. */
  previousChange: () => boolean
}

/** The comments, as the parts around the editing area see them. */
export interface EditorComments {
  /** Comments are on: there are threads to show. */
  enabled: ComputedRef<boolean>
  /** Threads can be started and answered. */
  writable: ComputedRef<boolean>
  threads: ComputedRef<readonly CommentThread[]>
  author: ComputedRef<CommentAuthor | undefined>
  /** The thread shown beside its text. */
  active: ComputedRef<string | null>
  /** The text a new thread is being started on. */
  pending: ShallowRef<CommentRange | null>
  /** Goes up when the open thread's reply box should take focus. */
  focusRequest: ShallowRef<number>
  /** The selected text, also in a read-only editor; `null` when there is none. */
  selection: () => CommentRange | null
  /** Start a thread on the selected text, or open the one the cursor is in. */
  start: () => boolean
  apply: (action: CommentAction) => void
  open: (id: string | null) => void
  /** Close the card, dropping a thread not yet started. */
  close: () => void
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
  comments: EditorComments
}

export const editorKey: InjectionKey<EditorContext> = Symbol('DouEditor')

const toolbarMenusKey: InjectionKey<Set<ShallowRef<boolean>>> = Symbol('DouEditorToolbarMenus')

/** For the formatting toolbar: the open state of the menus in it. */
export function provideToolbarMenus(): Set<ShallowRef<boolean>> {
  const menus = shallowReactive(new Set<ShallowRef<boolean>>())
  provide(toolbarMenusKey, menus)
  return menus
}

/**
 * The open state for a menu in the formatting toolbar (an extension's
 * `toolbar` component), to bind with `v-model:open`: the toolbar stays
 * while the menu is open, though the focus has left the editor.
 */
export function useToolbarMenu(): ShallowRef<boolean> {
  const open = shallowRef(false)
  const menus = inject(toolbarMenusKey, null)
  if (menus) {
    menus.add(open)
    onBeforeUnmount(() => menus.delete(open))
  }
  return open
}

/** The editor around a block component, for its messages, state and view. */
export function useEditor(): EditorContext {
  const context = inject(editorKey, null)
  if (!context) throw new Error('[@dou-ui/editor] useEditor() must be called inside <DouEditor>')
  return context
}
