import type { Node as PMNode } from 'prosemirror-model'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { allBlocks, findBlockById } from '../../core/blocks'

/**
 * Which toggles are closed, by block id. This is how one reader sees the
 * document, not part of it: opening a toggle does not change the document,
 * works while read-only, and is not shared with collaborators.
 */
interface ToggleState {
  closed: ReadonlySet<string>
  decorations: DecorationSet
}

export const toggleKey = new PluginKey<ToggleState>('dou-editor-toggle')

const isToggle = (node: PMNode) => node.firstChild?.type.name === 'toggle'

function decorate(doc: PMNode, closed: ReadonlySet<string>) {
  const decorations = allBlocks(doc)
    .filter((info) => isToggle(info.node) && closed.has(info.node.attrs.id))
    .map((info) =>
      Decoration.node(info.pos, info.pos + info.node.nodeSize, { class: 'is-collapsed' }),
    )
  return DecorationSet.create(doc, decorations)
}

/** Toggles around the cursor open, so the cursor never sits in hidden text. */
function revealSelection(state: EditorState, closed: Set<string>) {
  const { $head } = state.selection
  let changed = false
  // the cursor in a toggle's own title leaves it closed; only its children are hidden
  for (let depth = $head.depth - 1; depth > 0; depth--) {
    const node = $head.node(depth)
    if (node.type.name !== 'blockGroup') continue
    const block = $head.node(depth - 1)
    if (isToggle(block) && closed.delete(block.attrs.id)) changed = true
  }
  return changed
}

export function togglePlugin(): Plugin<ToggleState> {
  return new Plugin<ToggleState>({
    key: toggleKey,
    state: {
      // a document opens with its toggles closed; ones added later start open
      init(_config, state) {
        const closed = new Set(
          allBlocks(state.doc)
            .filter((info) => isToggle(info.node))
            .map((info) => info.node.attrs.id as string),
        )
        return { closed, decorations: decorate(state.doc, closed) }
      },
      apply(tr: Transaction, value, _old, state) {
        const flip = tr.getMeta(toggleKey) as string | undefined
        let closed = value.closed as Set<string>
        let changed = false
        const edit = () => {
          if (closed === value.closed) closed = new Set(closed)
          changed = true
        }
        if (flip) {
          edit()
          if (!closed.delete(flip)) closed.add(flip)
        }
        if (tr.selectionSet || tr.docChanged) {
          const copy = closed === value.closed ? new Set(closed) : closed
          if (revealSelection(state, copy)) {
            closed = copy
            changed = true
          }
        }
        if (!changed && !tr.docChanged) return value
        return { closed, decorations: decorate(state.doc, closed) }
      },
    },
    props: {
      decorations: (state) => toggleKey.getState(state)?.decorations,
    },
  })
}

export function isToggleOpen(state: EditorState | null, id: string): boolean {
  if (!state) return true
  return !toggleKey.getState(state)?.closed.has(id)
}

/** Open or close the toggle with this block id. */
export function flipToggle(view: EditorView, id: string) {
  const { state } = view
  const tr = state.tr.setMeta(toggleKey, id).setMeta('addToHistory', false)
  const info = findBlockById(state.doc, id)
  // closing around the cursor: take it to the end of the title
  if (info && isToggleOpen(state, id) && info.group) {
    const start = info.contentPos + info.content.nodeSize
    const { from } = state.selection
    if (from > start && from < info.pos + info.node.nodeSize)
      tr.setSelection(TextSelection.create(tr.doc, start - 1))
  }
  view.dispatch(tr)
}
