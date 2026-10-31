import { TextSelection, type Command, type EditorState } from 'prosemirror-state'
import { findBlockById } from '../blocks'
import { createPlugins, createState } from '../editor'
import { resolveEditorExtensions } from '../extension'
import { editorKit } from '../../extensions/editor-kit'
import { docToBlocks, type Block, type PartialBlock } from '../model'

export function stateOf(blocks: PartialBlock[]): EditorState {
  const kit = resolveEditorExtensions([editorKit()])
  const plugins = createPlugins({
    kit,
    placeholder: { text: () => '', heading: () => '', empty: () => '' },
  })
  return createState(kit, blocks, plugins)
}

/** Put the cursor (or a selection) inside blocks by id and text offset. */
export function at(state: EditorState, id: string, offset = 0, toId = id, toOffset = offset) {
  const from = findBlockById(state.doc, id)!
  const to = findBlockById(state.doc, toId)!
  const selection = TextSelection.create(
    state.doc,
    from.contentPos + 1 + offset,
    to.contentPos + 1 + toOffset,
  )
  return state.apply(state.tr.setSelection(selection))
}

export function run(state: EditorState, command: Command): { ok: boolean; state: EditorState } {
  let next = state
  const ok = command(state, (tr) => {
    next = state.apply(tr)
  })
  return { ok, state: next }
}

/** Blocks without ids, as `[type, text, children]` for compact assertions. */
export interface ShapeList extends Array<Shape> {}
export type Shape = [string, string] | [string, string, ShapeList]

export function shape(blocks: Block[]): Shape[] {
  return blocks.map((block) => {
    const text = block.content.map((item) => (item.type === 'text' ? item.text : '\n')).join('')
    return block.children.length ? [block.type, text, shape(block.children)] : [block.type, text]
  })
}

export const shapeOf = (state: EditorState) => shape(docToBlocks(state.doc))

/** Where the cursor is: the id of its block and the offset in its text. */
export function cursor(state: EditorState) {
  const { $from } = state.selection
  const block = $from.node($from.depth - 1)
  return { id: block.attrs.id as string, offset: $from.parentOffset }
}

export const p = (id: string, text = '', children: PartialBlock[] = []): PartialBlock => ({
  id,
  type: 'paragraph',
  content: text,
  children,
})
