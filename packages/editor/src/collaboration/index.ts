import type { Schema } from 'prosemirror-model'
import {
  prosemirrorToYXmlFragment,
  redoCommand,
  undoCommand,
  yCursorPlugin,
  ySyncPlugin,
  yUndoPlugin,
} from 'y-prosemirror'
import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'
import { defineExtension, resolveExtensions, type EditorExtension } from '../core/extension'
import { blocksToDoc, type PartialBlock } from '../core/model'
import { starterKit } from '../extensions/starter-kit'

/** How the people editing together see each other. */
export interface CollaborationUser {
  name: string
  /** A 6-digit hex color, e.g. `#3b6ea8`. Picked from the client id when left out. */
  color?: string
}

export interface CollaborationOptions {
  /** Where the document lives, e.g. `ydoc.getXmlFragment('document')`. */
  fragment: Y.XmlFragment
  /** Shares cursors and selections. Without it, others' cursors are not shown. */
  awareness?: Awareness
  /** This user, shown at their cursor to the others. Needs `awareness`. */
  user?: CollaborationUser
}

/** Deep, low-saturation colors that read on both light and dark surfaces. */
export const collaborationColors = [
  '#3b6ea8',
  '#a8553b',
  '#3b8a6e',
  '#8a3b7a',
  '#8a7a3b',
  '#5b4fa8',
  '#3b8a8a',
  '#a83b55',
]

function cursorElement(user: { name: string; color: string }) {
  const cursor = document.createElement('span')
  cursor.className = 'dou-editor__cursor'
  cursor.style.setProperty('--dou-editor-cursor-color', user.color)
  const label = document.createElement('span')
  label.className = 'dou-editor__cursor-label'
  label.textContent = user.name
  // word joiners keep the caret from breaking the line around it
  cursor.append('⁠', label, '⁠')
  return cursor
}

const selectionAttrs = (user: { color: string }) => ({
  class: 'dou-editor__remote-selection',
  style: `--dou-editor-cursor-color: ${user.color}`,
})

/**
 * Edit together through a Yjs document. The document lives in `fragment`:
 * the editor's `v-model` only mirrors it and changes to `v-model` are not
 * written back. Undo only takes back this user's own changes.
 */
export function collaboration(options: CollaborationOptions): EditorExtension {
  const { fragment, awareness, user } = options
  if (awareness && user) {
    const color =
      user.color ?? collaborationColors[fragment.doc!.clientID % collaborationColors.length]
    awareness.setLocalStateField('user', { name: user.name, color })
  }
  return defineExtension({
    name: 'collaboration',
    externalDocument: true,
    plugins: () => [
      ySyncPlugin(fragment),
      ...(awareness
        ? [
            yCursorPlugin(awareness, {
              cursorBuilder: cursorElement,
              selectionBuilder: selectionAttrs,
            }),
          ]
        : []),
    ],
    history: () => ({ plugins: [yUndoPlugin()], undo: undoCommand, redo: redoCommand }),
  })
}

/**
 * Write blocks into an empty fragment, e.g. when a document that so far
 * was saved as blocks starts being edited together. Do it once, where the
 * document is created (often on the server): two clients filling the same
 * empty fragment at the same time would both add their copy.
 */
export function fillFragment(
  fragment: Y.XmlFragment,
  blocks: PartialBlock[],
  extensions: (EditorExtension | EditorExtension[])[] = [starterKit()],
) {
  const schema: Schema = resolveExtensions(extensions).schema
  prosemirrorToYXmlFragment(blocksToDoc(schema, blocks), fragment)
}
