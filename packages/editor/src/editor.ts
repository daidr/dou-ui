import type { EditorState, Command, Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { inject, type ComputedRef, type InjectionKey, type ShallowRef } from 'vue'
import type { EditorExtension, ResolvedExtensions } from './core/extension'
import type { Block, PartialBlock } from './core/model'
import type { EditorMessages } from './locale'

export interface EditorProps {
  /**
   * The document as a list of blocks, bound with `v-model`. With
   * collaboration the shared document is the source of truth: leave
   * `v-model` out and read changes from the `change` event.
   */
  modelValue?: PartialBlock[]
  /**
   * Blocks, marks, shortcuts and menu entries. Defaults to `[starterKit()]`;
   * read once, when the editor mounts.
   */
  extensions?: (EditorExtension | EditorExtension[])[]
  /** Show the document without editing it. Links stay clickable. */
  readonly?: boolean
  /** The hint in the empty block under the cursor. */
  placeholder?: string
  /** Replace any of the built-in texts. */
  messages?: Partial<EditorMessages>
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
}

export interface EditorEmits {
  'update:modelValue': [blocks: Block[]]
  /** The document changed: typing, formatting, moving blocks. */
  change: [blocks: Block[]]
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
  kit: ResolvedExtensions
  /** The element the overlays are positioned against. */
  root: ShallowRef<HTMLElement | null>
}

export const editorKey: InjectionKey<EditorContext> = Symbol('DouEditor')

/** The editor around a block component, for its messages, state and view. */
export function useEditorContext(): EditorContext {
  const context = inject(editorKey, null)
  if (!context)
    throw new Error('[@dou-ui/editor] useEditorContext() is only available inside the editor')
  return context
}
