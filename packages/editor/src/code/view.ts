import {
  defineCodeExtension,
  type ChangeSet,
  type CodeCommandTarget,
  type CodeExtension,
  type CodeExtensionContext,
  type CodeHistoryHandler,
  type CodeKeymap,
} from '@dou-ui/code'
import type { Node as PMNode } from 'prosemirror-model'
import { Selection, TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view'
import { shallowReactive } from 'vue'
import { getBlockSelection, selectCurrentBlocks } from '../core/block-selection'
import { exitCode, setBlockType } from '../core/commands'
import { historyCommands } from '../core/editor'
import type { MountComponent } from '../core/extension'
import CodeEditorBlock from './code-editor-block.vue'
import type { CodeEditorViewOptions, CodeEditorViewState } from './types'

/** Marks the changes that came from the document, so they aren't sent back. */
const FROM_DOC = 'editorDocument'

/** The first and last places that differ between two texts. */
function diff(a: string, b: string) {
  let start = 0
  const min = Math.min(a.length, b.length)
  while (start < min && a.charCodeAt(start) === b.charCodeAt(start)) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a.charCodeAt(endA - 1) === b.charCodeAt(endB - 1)) {
    endA--
    endB--
  }
  return { from: start, to: endA, insert: b.slice(start, endB) }
}

/** One cursor and nothing selected: the arrows may leave the block. */
const cursor = (target: CodeCommandTarget) => {
  const { ranges, main } = target.state.selection
  const range = ranges[main]!
  return ranges.length === 1 && range.anchor === range.head ? range : null
}

/**
 * The code block's node view: the code editor owns the text, and every
 * change it makes goes into the document as a step, with the selection,
 * so undo, collaboration and the other blocks see an ordinary edit. Changes
 * to the document from elsewhere (undo, someone else) come back into the
 * editor the same way.
 */
export function codeEditorView(
  mount: MountComponent,
  options: CodeEditorViewOptions,
): NodeViewConstructor {
  return (node, view, getPos) => {
    let current: PMNode = node
    let ctx: CodeExtensionContext | null = null
    // set while one side writes to the other, so it doesn't come back
    let updating = false
    let historyAction: 'undo' | 'redo' | null = null

    const idOf = () => {
      const pos = getPos()
      if (pos === undefined) return ''
      return (view.state.doc.resolve(pos).parent.attrs.id as string | null) ?? ''
    }
    const state = shallowReactive<CodeEditorViewState>({
      block: { id: idOf(), props: { ...node.attrs } },
      text: node.textContent,
      editable: view.editable,
      selected: false,
    })

    /** The code's changes and selection, into the document. */
    function forward(changes: ChangeSet | null, c: CodeExtensionContext) {
      const pos = getPos()
      if (pos === undefined || updating) return
      const start = pos + 1
      const tr = view.state.tr
      if (changes) {
        const list = changes.changes
        // from the end, so the positions before each change still hold
        for (let i = list.length - 1; i >= 0; i--) {
          const change = list[i]!
          if (change.insert) tr.insertText(change.insert, start + change.from, start + change.to)
          else tr.delete(start + change.from, start + change.to)
        }
      }
      if (c.focused) {
        const main = c.selection.ranges[c.selection.main]!
        const selection = TextSelection.create(tr.doc, start + main.anchor, start + main.head)
        if (!selection.eq(view.state.selection)) tr.setSelection(selection)
      }
      if (!tr.docChanged && !tr.selectionSet) return
      updating = true
      try {
        view.dispatch(tr)
      } finally {
        updating = false
      }
    }

    function runHistory(kind: 'undo' | 'redo') {
      const command = historyCommands(view.state)[kind]
      historyAction = kind
      let done: boolean
      try {
        done = command(view.state, view.dispatch, view)
      } finally {
        historyAction = null
      }
      if (!done) return false
      // the step undone may be elsewhere in the document: the cursor goes there
      const pos = getPos()
      const { anchor, head } = view.state.selection
      if (pos !== undefined && ctx && inside(pos, anchor) && inside(pos, head)) {
        updating = true
        try {
          ctx.select(anchor - pos - 1, head - pos - 1)
        } finally {
          updating = false
        }
      } else view.focus()
      return true
    }
    const inside = (pos: number, at: number) => at > pos && at < pos + current.nodeSize

    /** The document's undo, so it's one history with the other blocks. */
    const history: CodeHistoryHandler = {
      undo: () => runHistory('undo'),
      redo: () => runHistory('redo'),
      canUndo: () => historyCommands(view.state).undo(view.state),
      canRedo: () => historyCommands(view.state).redo(view.state),
    }

    /** Puts the cursor in the block before (`-1`) or after; `false` when there is none. */
    function leave(dir: -1 | 1) {
      const pos = getPos()
      if (pos === undefined) return false
      const $pos = view.state.doc.resolve(dir < 0 ? pos : pos + current.nodeSize)
      const selection = Selection.near($pos, dir)
      if (selection.from > pos && selection.to < pos + current.nodeSize) return false
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView())
      view.focus()
      return true
    }

    const keymap: CodeKeymap = {
      arrowleft: (target) => cursor(target)?.head === 0 && leave(-1),
      arrowright: (target) => cursor(target)?.head === target.state.doc.length && leave(1),
      arrowup: (target) => {
        const range = cursor(target)
        if (!range || target.state.doc.lineAt(range.head).number !== 1) return false
        return target.moveVertically(range, -1) === 0 && leave(-1)
      },
      arrowdown: (target) => {
        const range = cursor(target)
        const { doc } = target.state
        if (!range || doc.lineAt(range.head).number !== doc.lines) return false
        return target.moveVertically(range, 1) === doc.length && leave(1)
      },
      // Backspace in an empty block turns it into a paragraph, as in the others
      backspace: (target) => {
        if (target.readonly || target.state.doc.length > 0) return false
        if (!setBlockType('paragraph')(view.state, view.dispatch)) return false
        view.focus()
        return true
      },
      'mod+enter': (target) => {
        if (target.readonly || !exitCode(view.state, view.dispatch)) return false
        view.focus()
        return true
      },
      // Escape selects the block, as in the others; after leaving multiple cursors and search
      escape: (target) => {
        if (target.state.selection.ranges.length > 1) return false
        if (ctx?.closeSearch()) return true
        if (!selectCurrentBlocks(view.state, view.dispatch)) return false
        view.focus()
        return true
      },
    }

    const bridge: CodeExtension = defineCodeExtension({
      name: 'editor-code-block',
      priority: 1000,
      keymap: () => keymap,
      history: () => history,
      update(result, c) {
        if (result.meta[FROM_DOC]) return
        forward(result.changes.empty ? null : result.changes, c)
      },
      setup(c) {
        ctx = c
        return () => {
          if (ctx === c) ctx = null
        }
      },
    })

    const dom = document.createElement('div')
    dom.className =
      'dou-editor__content dou-editor__content--codeBlock dou-editor__content--custom dou-editor-code-editor'
    dom.dataset.contentType = 'codeBlock'
    const unmount = mount(
      CodeEditorBlock,
      {
        state,
        options,
        extensions: [bridge, ...(options.extensions ?? [])],
        view,
        updateProps(props: Record<string, unknown>) {
          const pos = getPos()
          if (pos === undefined) return
          const at = view.state.doc.nodeAt(pos)
          if (!at) return
          view.dispatch(
            view.state.tr.setNodeMarkup(pos, undefined, {
              ...at.attrs,
              ...props,
            }),
          )
        },
        // focusing the editor shows the cursor in the document too
        onFocus: () => ctx && forward(null, ctx),
      },
      dom,
    )

    const nodeView: NodeView = {
      dom,
      update(next) {
        if (next.type !== current.type) return false
        const before = current
        current = next
        state.block = { id: idOf(), props: { ...next.attrs } }
        state.editable = view.editable
        if (updating || next.textContent === before.textContent) return true
        if (!ctx) {
          state.text = next.textContent
          return true
        }
        const change = diff(ctx.doc.toString(), next.textContent)
        if (change.from === change.to && !change.insert) return true
        updating = true
        try {
          ctx.transact((tr) => tr.replace(change.from, change.to, change.insert), {
            action: historyAction ?? 'remote',
            history: false,
            scroll: !!historyAction,
            [FROM_DOC]: true,
          })
        } finally {
          updating = false
        }
        return true
      },
      // the document's cursor moved into the block (an arrow key, a click on its edge)
      setSelection(anchor, head) {
        // a selection of whole blocks covers this one too: it stays with the document
        if (!ctx || updating || getBlockSelection(view.state)) return
        updating = true
        try {
          ctx.focus()
          ctx.select(anchor, head)
        } finally {
          updating = false
        }
      },
      selectNode() {
        state.selected = true
      },
      deselectNode() {
        state.selected = false
      },
      // the editor handles its own events; blocks dragged by the handle may still drop here
      stopEvent: (event) =>
        !(view.dragging && (event.type === 'drop' || event.type.startsWith('drag'))),
      ignoreMutation: () => true,
      destroy() {
        unmount()
      },
    }
    return nodeView
  }
}

export type { EditorView }
