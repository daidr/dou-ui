import type { Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state'
import { ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { createId } from './model'

/**
 * Whether a transaction came from another collaborator. Collaborative
 * bindings mark theirs; the Yjs binding uses the `y-sync$` key.
 */
export function isRemote(tr: Transaction): boolean {
  const meta = tr.getMeta('y-sync$') as { isChangeOrigin?: boolean } | undefined
  return !!meta?.isChangeOrigin || tr.getMeta('remote') === true
}

/**
 * Every block gets a unique id. Splitting a block copies its attributes,
 * so the copy gets a fresh id here; the first occurrence keeps the old one.
 * Changes from collaborators are left alone, so two editors never fight
 * over an id.
 */
export function idPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('dou-editor-ids'),
    appendTransaction(transactions, _old, state) {
      if (!transactions.some((tr) => tr.docChanged) || transactions.every(isRemote)) return null
      const seen = new Set<string>()
      let tr: Transaction | null = null
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'block') return node.type.name === 'blockGroup'
        const id = node.attrs.id as string | null
        if (!id || seen.has(id)) {
          tr ??= state.tr
          const fresh = createId()
          tr.setNodeAttribute(pos, 'id', fresh)
          seen.add(fresh)
        } else seen.add(id)
        return true
      })
      if (tr) (tr as Transaction).setMeta('addToHistory', false)
      return tr
    },
  })
}

/**
 * Whether a transaction may have changed which blocks there are, their
 * types or their nesting. Typing and deleting inside one text block, marks
 * and attributes don't; decorations that only follow the block structure
 * then just map through the change instead of being rebuilt.
 */
export function changesBlockStructure(tr: Transaction): boolean {
  if (!tr.docChanged) return false
  return tr.steps.some((step, index) => {
    if (step instanceof ReplaceAroundStep) return true
    if (!(step instanceof ReplaceStep)) return false
    const { from, to, slice } = step
    if (slice.openStart || slice.openEnd) return true
    let blocks = false
    slice.content.forEach((node) => {
      if (!node.isInline) blocks = true
    })
    if (blocks) return true
    const doc = tr.docs[index]!
    const $from = doc.resolve(from)
    return !$from.parent.isTextblock || !$from.sameParent(doc.resolve(to))
  })
}

/** Plugin state for decorations that only depend on the block structure. */
const structureDecorations = (
  build: (doc: PMNode) => DecorationSet,
  update: (set: DecorationSet, tr: Transaction) => DecorationSet = (_set, tr) => build(tr.doc),
) => ({
  init: (_config: unknown, state: { doc: PMNode }) => build(state.doc),
  apply: (tr: Transaction, value: DecorationSet) =>
    !tr.docChanged
      ? value
      : changesBlockStructure(tr)
        ? update(value, tr)
        : value.map(tr.mapping, tr.doc),
})

const isList = (block: PMNode | null) => !!block?.firstChild?.type.spec.continues

/** Whether a sibling block is an item of the same list as `block`. */
const sameList = (sibling: PMNode, block: PMNode) =>
  isList(sibling) && sibling.firstChild!.type === block.firstChild!.type

/**
 * The content of blocks that continue like a list (`continues` in their
 * spec) gets `is-list`, so the stylesheet can space list items apart by the list gap
 * instead of the block gap. The first and last block of a run of them also
 * get `is-list-start` / `is-list-end`, where the block gap comes back. A run
 * is one type: a to-do list right after a numbered one is a list of its
 * own. Nested items under a list item, of any type, carry on its run.
 */
/** The list decorations of top-level blocks `first` to `final` (and their children). */
function listDecorationsOf(doc: PMNode, first: number, final: number): Decoration[] {
  const decorations: Decoration[] = []
  const visit = (container: PMNode, start: number, inList: boolean, from = 0, to = Infinity) => {
    const last = container.childCount - 1
    container.forEach((block, offset, index) => {
      if (index < from || index > to) return
      const pos = start + offset
      const content = block.firstChild!
      const groupPos = pos + 1 + content.nodeSize
      const list = isList(block)
      if (list) {
        // all on the content (or the children's group), never on the block
        // itself: the view looks up a block's own decorations by scanning
        // all of its parent's, and a selector matching blocks by what they
        // hold would be checked again for every block when blocks change
        const classes = ['is-list']
        const previous = index > 0 ? container.child(index - 1) : null
        if (!(previous ? sameList(previous, block) : inList)) {
          classes.push('is-list-start')
          // right after another list: the two edges overlap
          if (previous && isList(previous)) classes.push('is-list-after')
        }
        const end = !(index < last ? sameList(container.child(index + 1), block) : inList)
        if (end && block.childCount < 2) classes.push('is-list-end')
        decorations.push(Decoration.node(pos + 1, groupPos, { class: classes.join(' ') }))
        if (end && block.childCount > 1)
          decorations.push(
            Decoration.node(groupPos, groupPos + block.child(1).nodeSize, { class: 'is-list-end' }),
          )
      }
      if (block.childCount > 1) visit(block.child(1), groupPos + 1, list)
    })
  }
  visit(doc, 0, false, first, final)
  return decorations
}

const listDecorations = (doc: PMNode) =>
  DecorationSet.create(doc, listDecorationsOf(doc, 0, doc.childCount - 1))

/**
 * After blocks were added, removed or changed type: only the top-level
 * blocks the change touched, and one on either side (whose run may have
 * started or ended there), are worked out again.
 */
function updateListDecorations(set: DecorationSet, tr: Transaction): DecorationSet {
  const { doc, mapping } = tr
  let from = doc.content.size
  let to = 0
  mapping.maps.forEach((map, index) => {
    const rest = mapping.slice(index + 1)
    map.forEach((_oldStart, _oldEnd, start, end) => {
      from = Math.min(from, rest.map(start, -1))
      to = Math.max(to, rest.map(end, 1))
    })
  })
  const mapped = set.map(mapping, doc)
  if (from > to) return mapped
  const first = Math.max(0, doc.resolve(from).index(0) - 1)
  const last = Math.min(doc.childCount - 1, doc.resolve(to).index(0) + 1)
  let start = 0
  for (let index = 0; index < first; index++) start += doc.child(index).nodeSize
  let end = start
  for (let index = first; index <= last; index++) end += doc.child(index).nodeSize
  return mapped.remove(mapped.find(start, end)).add(doc, listDecorationsOf(doc, first, last))
}

/** Marks list-like blocks and the ends of their runs, for spacing. */
export function listPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: new PluginKey('dou-editor-lists'),
    state: structureDecorations(listDecorations, updateListDecorations),
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}

/** Numbered items count up within each run of consecutive numbered siblings. */
function numberDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = []
  const visit = (container: PMNode, start: number) => {
    let count = 0
    container.forEach((block, offset) => {
      const pos = start + offset
      const content = block.firstChild
      if (content?.type.name === 'numberedItem') {
        count++
        decorations.push(
          Decoration.node(pos + 1, pos + 1 + content.nodeSize, { 'data-index': String(count) }),
        )
      } else count = 0
      if (block.childCount > 1) visit(block.child(1), pos + 1 + content!.nodeSize + 1)
    })
  }
  visit(doc, 0)
  return DecorationSet.create(doc, decorations)
}

export function numberingPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: new PluginKey('dou-editor-numbering'),
    state: structureDecorations(numberDecorations),
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}

export interface PlaceholderOptions {
  /** The hint in the empty block the cursor is in. */
  text: () => string
  /** The hint in an empty heading. */
  heading: () => string
  /** The hint when the whole document is one empty paragraph. */
  empty: () => string
}

/** A hint inside the empty block under the cursor, and in an empty document. */
export function placeholderPlugin(options: PlaceholderOptions): Plugin {
  return new Plugin({
    key: new PluginKey('dou-editor-placeholder'),
    props: {
      decorations(state) {
        const { doc, selection } = state
        const decorations: Decoration[] = []
        const onlyBlock =
          doc.childCount === 1 && doc.firstChild!.childCount === 1 && doc.firstChild!.firstChild!
        if (onlyBlock && onlyBlock.type.name === 'paragraph' && onlyBlock.content.size === 0) {
          decorations.push(
            Decoration.node(1, 1 + onlyBlock.nodeSize, {
              class: 'is-empty',
              'data-placeholder': options.empty(),
            }),
          )
          return DecorationSet.create(doc, decorations)
        }
        const { $from } = selection
        const parent = $from.parent
        if (!selection.empty || !parent.isTextblock || parent.content.size > 0) return null
        if (parent.type.spec.code) return null
        const text = parent.type.name === 'heading' ? options.heading() : options.text()
        const start = $from.before()
        decorations.push(
          Decoration.node(start, start + parent.nodeSize, {
            class: 'is-empty',
            'data-placeholder': text,
          }),
        )
        return DecorationSet.create(doc, decorations)
      },
    },
  })
}
