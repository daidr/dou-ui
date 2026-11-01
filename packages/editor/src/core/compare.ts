import type { Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { diffBlocks, diffText, inlineText, type BlockChange } from './diff'
import { docToBlocks, type Block } from './model'

/*
 * The document compared with an older version, drawn over the text: blocks
 * added since have a bar beside them, blocks removed show where they were,
 * struck through, and in a changed block the text added is underlined and
 * the text removed shown struck through where it was. Colors aside, each
 * kind has its own line, so they read the same to everyone.
 */

export const compareKey = new PluginKey<DecorationSet>('compare')

const CLS = 'dou-editor__diff'

/** The text of a removed block, as a line of its own. */
function removedBlock(block: Block, label: (block: Block) => string) {
  const el = document.createElement('div')
  el.className = `${CLS}-removed-block`
  el.dataset.diff = 'removed'
  const text = inlineText(block.content).replaceAll('￼', '')
  el.textContent = text || label(block)
  return el
}

function removedText(text: string) {
  const el = document.createElement('del')
  el.className = `${CLS}-removed`
  el.dataset.diff = 'removed'
  el.textContent = text.replaceAll('￼', '')
  return el
}

function decorate(doc: PMNode, before: readonly Block[], label: (block: Block) => string) {
  const { changes } = diffBlocks(before, docToBlocks(doc))
  if (!changes.length) return DecorationSet.empty
  const byId = new Map<string, BlockChange>()
  /** Removed blocks, by the id of the block they stood before (`null`: the end). */
  const removedAt = new Map<string | null, Block[]>()
  for (const change of changes) {
    if (change.type !== 'removed') byId.set(change.id, change)
    else {
      const list = removedAt.get(change.next) ?? []
      list.push(change.before)
      removedAt.set(change.next, list)
    }
  }

  const decorations: Decoration[] = []
  const putRemoved = (pos: number, id: string | null) => {
    for (const [index, block] of (removedAt.get(id) ?? []).entries())
      decorations.push(
        Decoration.widget(pos, () => removedBlock(block, label), {
          side: -1,
          key: `removed-${block.id}-${index}`,
          ignoreSelection: true,
        }),
      )
  }
  // a block's id is where its changes and the removed blocks before it are found
  const ids = new Set([...byId.keys(), ...removedAt.keys()])
  doc.descendants((node, pos) => {
    if (node.type.name !== 'block') return true
    const id = node.attrs.id as string
    if (!ids.has(id)) return true
    putRemoved(pos, id)
    const change = byId.get(id)
    if (change?.type === 'added')
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: `${CLS}-added` }))
    else if (change?.type === 'changed') {
      const content = node.firstChild!
      const sameKind =
        change.before.type === change.after.type &&
        JSON.stringify(change.before.props) === JSON.stringify(change.after.props)
      if (!sameKind || change.after.rows || !content.inlineContent)
        decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: `${CLS}-changed` }))
      if (content.inlineContent && !change.after.rows) {
        // the content node starts inside the block: one for the block, one for the content
        const start = pos + 2
        let offset = 0
        const parts = diffText(inlineText(change.before.content), inlineText(change.after.content))
        for (const [index, part] of parts.entries()) {
          const at = start + offset
          if (part.type === 'same') offset += part.text.length
          else if (part.type === 'added') {
            decorations.push(
              Decoration.inline(at, at + part.text.length, {
                class: `${CLS}-added-text`,
                'data-diff': 'added',
              }),
            )
            offset += part.text.length
          } else
            decorations.push(
              Decoration.widget(at, () => removedText(part.text), {
                side: -1,
                key: `removed-${id}-${index}-${part.text}`,
                ignoreSelection: true,
              }),
            )
        }
      }
    }
    return true
  })
  putRemoved(doc.content.size, null)
  return DecorationSet.create(doc, decorations)
}

/** Draws the changes from `before()`; `null` draws none. */
export function comparePlugin(options: {
  before: () => readonly Block[] | null | undefined
  /** What to show for a removed block without text, such as a divider. */
  label: (block: Block) => string
}) {
  const build = (doc: PMNode) => {
    const before = options.before()
    return before ? decorate(doc, before, options.label) : DecorationSet.empty
  }
  return new Plugin<DecorationSet>({
    key: compareKey,
    state: {
      init: (_, state) => build(state.doc),
      apply: (tr, value) =>
        tr.docChanged || tr.getMeta(compareKey) ? build(tr.doc) : value.map(tr.mapping, tr.doc),
    },
    props: {
      decorations: (state) => compareKey.getState(state),
    },
  })
}
