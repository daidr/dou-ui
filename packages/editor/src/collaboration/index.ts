import {
  applySharedCommentAction,
  collaborationColors,
  readSharedComments,
  type CommentThread,
  type SharedCommentMap,
} from 'dou-ui'
import { shallowRef } from 'vue'
import { Plugin, TextSelection, type Command } from 'prosemirror-state'
import * as Y from 'yjs'
import {
  defineEditorExtension,
  resolveEditorExtensions,
  type EditorExtension,
} from '../core/extension'
import { blocksToDoc, docToBlocks, type EditorDocument, type PartialBlock } from '../core/model'
import { editorKit } from '../extensions/editor-kit'
import { createBinding, readDoc, syncPlugin, updateDoc, writeDoc, type YBlock } from './binding'
import {
  cursorAt,
  cursorsPlugin,
  positionOf,
  type AwarenessLike,
  type CursorTarget,
  type EditorCursor,
  type EditorCursorPlace,
} from './cursors'

/** How the people editing together see each other. */
export interface CollaborationUser {
  name: string
  /** The cursor color, any CSS color. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the document lives, e.g. `ydoc.getMap('document')`. */
  map: Y.Map<unknown>
  /** Shares cursors and selections (`y-protocols/awareness`). Without it, others' cursors are not shown. */
  awareness?: AwarenessLike
  /** This user, shown at their cursor to the others. Needs `awareness`. */
  user?: CollaborationUser
  /**
   * Where the comment threads live, e.g. `ydoc.getMap('comments')`, so
   * they reach everyone with the document. `v-model:comments` then only
   * mirrors them. Without it, the text's anchors still travel with the
   * document and the threads are the app's to share.
   */
  comments?: Y.Map<unknown>
}

export { collaborationColors }

/**
 * Edit together through a Yjs document. The document lives in `map`: the
 * editor's `v-model` only mirrors it and changes to `v-model` are not
 * written back. Undo only takes back this user's own changes.
 */
export function collaboration(options: CollaborationOptions): EditorExtension {
  const map = options.map as Y.Map<YBlock>
  const { awareness, user } = options
  if (awareness && user) {
    const color = user.color ?? collaborationColors[map.doc!.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }
  const binding = createBinding(map)
  const undoManager = new Y.UndoManager(map, {
    trackedOrigins: new Set([binding.origin]),
    captureTimeout: 500,
  })
  binding.stopCapturing = () => undoManager.stopCapturing()
  // put the cursor back where it was when the change was made
  undoManager.on('stack-item-added', (event: { stackItem: { meta: Map<string, unknown> } }) => {
    if (!event.stackItem.meta.has('selection'))
      event.stackItem.meta.set('selection', binding.selectionBefore ?? null)
  })
  undoManager.on('stack-item-popped', (event: { stackItem: { meta: Map<string, unknown> } }) => {
    const view = binding.view
    const place = event.stackItem.meta.get('selection') as Parameters<typeof positionOf>[2] | null
    if (!view || !place) return
    const pos = positionOf(binding, view.state.doc, place)
    if (pos === null) return
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos))))
  })
  const run =
    (action: 'undo' | 'redo'): Command =>
    (_state, dispatch) => {
      const stack = action === 'undo' ? undoManager.undoStack : undoManager.redoStack
      if (!stack.length) return false
      if (dispatch) {
        binding.undoing = action
        try {
          undoManager[action]()
        } finally {
          binding.undoing = undefined
        }
      }
      return true
    }

  const shared = options.comments
  const threads = shallowRef<readonly CommentThread[]>([])
  const readThreads = () => (threads.value = readSharedComments(shared as SharedCommentMap))
  if (shared) readThreads()
  // follows the shared threads while the editor is there
  const commentsPlugin = new Plugin({
    view: () => {
      shared!.observe(readThreads)
      readThreads()
      return { destroy: () => shared!.unobserve(readThreads) }
    },
  })

  return defineEditorExtension({
    name: 'collaboration',
    externalDocument: true,
    comments: shared
      ? () => ({
          threads,
          apply: (action) =>
            applySharedCommentAction(shared as SharedCommentMap, action, binding.untracked),
        })
      : undefined,
    plugins: () => [
      syncPlugin(binding),
      ...(awareness ? [cursorsPlugin(binding, awareness)] : []),
      ...(shared ? [commentsPlugin] : []),
    ],
    history: () => ({ plugins: [], undo: run('undo'), redo: run('redo') }),
  })
}

type ExtensionList = (EditorExtension | EditorExtension[])[]

/** The extensions the editors of the shared document use; `[editorKit()]` when left out. */
const schemaOf = (extensions: ExtensionList = [editorKit()]) =>
  resolveEditorExtensions(extensions).schema

/** Runs `write` as one transaction of the map's document, from `origin`. */
function transact(map: Y.Map<unknown>, write: () => void, origin: unknown) {
  if (map.doc) map.doc.transact(write, origin ?? null)
  else write()
}

export interface FillMapOptions {
  /** The extensions the editors use, for custom blocks. Defaults to `[editorKit()]`. */
  extensions?: ExtensionList
  /** The origin of the Yjs transaction, so the others can tell who wrote it. */
  origin?: unknown
}

/**
 * Write a document into an empty map, e.g. when a document that so far was
 * saved as JSON starts being edited together. Do it once, where the
 * document is created (often on the server): two clients filling the same
 * empty map at the same time would both add their copy.
 */
export function fillMap(
  map: Y.Map<unknown>,
  doc: EditorDocument<PartialBlock>,
  options: FillMapOptions = {},
) {
  const schema = schemaOf(options.extensions)
  transact(
    map,
    () => writeDoc(map as Y.Map<YBlock>, blocksToDoc(schema, doc.blocks)),
    options.origin,
  )
}

export interface UpdateMapOptions extends FillMapOptions {
  /**
   * The version `doc` was made from, e.g. the one read with `readMap` and
   * given to a program that took a while to write `doc`. Only what differs
   * between `base` and `doc` is written, so what others changed in the map
   * meanwhile stays. Get it the same way as `doc`: when `doc` is read from
   * Markdown, read `base` from the Markdown the program was given. Left
   * out, the map as it is now.
   */
  base?: EditorDocument<PartialBlock>
}

/**
 * Change a shared map from `options.base` to `doc`, without an editor, e.g.
 * on the server when a program wrote a new version while people edit the
 * document. Only what differs is written: blocks keep their id and their
 * text is changed character by character, so the cursors, undo and comment
 * threads of the others stay. Blocks with new ids (e.g. read from Markdown)
 * are matched to the stored ones by content and place; one that matches
 * none is written as a new block, and one left over is removed. An empty
 * map is filled.
 */
export function updateMap(
  map: Y.Map<unknown>,
  doc: EditorDocument<PartialBlock>,
  options: UpdateMapOptions = {},
) {
  const schema = schemaOf(options.extensions)
  const { base } = options
  transact(
    map,
    () =>
      updateDoc(
        map as Y.Map<YBlock>,
        blocksToDoc(schema, doc.blocks),
        schema,
        base && blocksToDoc(schema, base.blocks),
      ),
    options.origin,
  )
}

export interface ReadMapOptions {
  /** The extensions the editors use, for custom blocks. Defaults to `[editorKit()]`. */
  extensions?: ExtensionList
}

/**
 * The document a shared map holds, read without an editor, e.g. to save a
 * version on the server. An empty map reads as no blocks.
 */
export function readMap(map: Y.Map<unknown>, options: ReadMapOptions = {}): EditorDocument {
  const doc = readDoc(map as Y.Map<YBlock>, schemaOf(options.extensions))
  return { version: 1, blocks: doc ? docToBlocks(doc) : [] }
}

export { cursorAt }
export type { AwarenessLike, CursorTarget, EditorCursor, EditorCursorPlace }
