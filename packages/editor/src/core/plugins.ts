import type { Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state'
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

const isList = (block: PMNode | null) => !!block?.firstChild?.type.spec.continues

/**
 * Blocks that continue like a list (`continues` in their spec) get
 * `is-list`, so the stylesheet can space list items apart by the list gap
 * instead of the block gap. The first and last block of a run of them also
 * get `is-list-start` / `is-list-end`, where the block gap comes back. A
 * nested run under a list item carries on its parent's run.
 */
function listDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = []
  const visit = (container: PMNode, start: number, inList: boolean) => {
    const last = container.childCount - 1
    container.forEach((block, offset, index) => {
      const pos = start + offset
      const list = isList(block)
      if (list) {
        const classes = ['is-list']
        if (!(index > 0 ? isList(container.child(index - 1)) : inList))
          classes.push('is-list-start')
        if (!(index < last ? isList(container.child(index + 1)) : inList))
          classes.push('is-list-end')
        decorations.push(Decoration.node(pos, pos + block.nodeSize, { class: classes.join(' ') }))
      }
      if (block.childCount > 1)
        visit(block.child(1), pos + 1 + block.firstChild!.nodeSize + 1, list)
    })
  }
  visit(doc, 0, false)
  return DecorationSet.create(doc, decorations)
}

/** Marks list-like blocks and the ends of their runs, for spacing. */
export function listPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: new PluginKey('dou-editor-lists'),
    state: {
      init: (_config, state) => listDecorations(state.doc),
      apply: (tr, value) => (tr.docChanged ? listDecorations(tr.doc) : value),
    },
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
    state: {
      init: (_config, state) => numberDecorations(state.doc),
      apply: (tr, value) => (tr.docChanged ? numberDecorations(tr.doc) : value),
    },
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
