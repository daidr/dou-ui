import { collaborationColors } from 'dou-ui'
import { TextSelection, type Command } from 'prosemirror-state'
import * as Y from 'yjs'
import {
  defineEditorExtension,
  resolveEditorExtensions,
  type EditorExtension,
} from '../core/extension'
import { blocksToDoc, type PartialBlock } from '../core/model'
import { editorKit } from '../extensions/editor-kit'
import { createBinding, syncPlugin, writeDoc, type YBlock } from './binding'
import { cursorsPlugin, positionOf, type AwarenessLike } from './cursors'

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

  return defineEditorExtension({
    name: 'collaboration',
    externalDocument: true,
    plugins: () => [syncPlugin(binding), ...(awareness ? [cursorsPlugin(binding, awareness)] : [])],
    history: () => ({ plugins: [], undo: run('undo'), redo: run('redo') }),
  })
}

/**
 * Write blocks into an empty map, e.g. when a document that so far was
 * saved as blocks starts being edited together. Do it once, where the
 * document is created (often on the server): two clients filling the same
 * empty map at the same time would both add their copy.
 */
export function fillMap(
  map: Y.Map<unknown>,
  blocks: PartialBlock[],
  extensions: (EditorExtension | EditorExtension[])[] = [editorKit()],
) {
  const schema = resolveEditorExtensions(extensions).schema
  writeDoc(map as Y.Map<YBlock>, blocksToDoc(schema, blocks))
}

export type { AwarenessLike }
