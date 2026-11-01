import type { EditorState, Command, Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { CommentAction, CommentAuthor, CommentThread } from 'dou-ui'
import { inject, type ComputedRef, type InjectionKey, type ShallowRef } from 'vue'
import type { CommentAnchor, CommentRange } from './core/comments'
import type { EditorExtension, ResolvedEditorExtensions } from './core/extension'
import type { Block, PartialBlock } from './core/model'
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
   * The comment threads, bound with `v-model:comments`. The text a thread
   * is about carries its id in the document; leave this out to turn
   * comments off.
   */
  comments?: CommentThread[]
  /** Who is commenting. Without it comments can be read but not written. */
  author?: CommentAuthor
  /** The id of the thread shown beside its text, bound with `v-model:active-comment`. */
  activeComment?: string | null
  /** Whether threads can be started and answered; also while `readonly`. Defaults to `true`. */
  commentable?: boolean
}

export interface EditorEmits {
  'update:modelValue': [blocks: Block[]]
  /** The document changed: typing, formatting, moving blocks. */
  change: [blocks: Block[]]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
  'update:comments': [threads: CommentThread[]]
  'update:activeComment': [id: string | null]
  /** A change to the comments made here: to send to a server, notify people, keep a log. */
  commentAction: [action: CommentAction]
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
   * Start a thread on the selected text and open the box for its first
   * comment; with the cursor on commented text, open that thread to reply.
   */
  comment: () => boolean
  /** Where each thread is anchored; `null` for a thread whose text was deleted. */
  getCommentAnchors: () => Record<string, CommentAnchor | null>
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

/** The editor around a block component, for its messages, state and view. */
export function useEditor(): EditorContext {
  const context = inject(editorKey, null)
  if (!context) throw new Error('[@dou-ui/editor] useEditor() is only available inside the editor')
  return context
}
