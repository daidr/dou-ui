import { Plugin, PluginKey, type EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

/**
 * The slash menu's state: open from the `/` at `from` to the cursor,
 * with the text typed after it as the query. A Chinese keyboard types
 * `、` for the same key, so that opens it too.
 */
export interface SlashState {
  from: number
  query: string
}

export const slashKey = new PluginKey<SlashState | null>('dou-editor-slash')

const TRIGGERS = ['/', '、']

export interface SlashOptions {
  /** The menu reads the state; called whenever it changes. */
  onChange: (state: SlashState | null, view: EditorView) => void
  /** Keys go to the open menu first: arrows, `Enter`, `Tab`. Return whether it took the key. */
  onKey: (event: KeyboardEvent) => boolean
}

export function getSlash(state: EditorState): SlashState | null {
  return slashKey.getState(state) ?? null
}

export function closeSlash(view: EditorView) {
  if (getSlash(view.state)) view.dispatch(view.state.tr.setMeta(slashKey, null))
}

export function slashPlugin(options: SlashOptions): Plugin<SlashState | null> {
  return new Plugin<SlashState | null>({
    key: slashKey,
    state: {
      init: () => null,
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(slashKey) as SlashState | null | undefined
        if (meta !== undefined) return meta
        if (!value) return null
        const from = tr.mapping.map(value.from)
        const { $head, empty } = state.selection
        // close when the cursor leaves the query or the trigger is deleted
        if (!empty || $head.pos <= from || $head.pos - from > 40) return null
        const $from = state.doc.resolve(from)
        if (!$from.sameParent($head)) return null
        const text = state.doc.textBetween(from, $head.pos)
        if (!TRIGGERS.includes(text[0] ?? '')) return null
        const query = text.slice(1)
        // two spaces in a row: the user is typing prose, not searching
        if (/\s\s/.test(query)) return null
        return { from, query }
      },
    },
    props: {
      handleTextInput(view, from, to, text) {
        if (!TRIGGERS.includes(text) || getSlash(view.state)) return false
        const $from = view.state.doc.resolve(from)
        if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false
        const before = $from.parent.textBetween(0, $from.parentOffset)
        // not right after a letter, digit or URL punctuation: `a/b`, `https://`
        if (/[\w:/.]$/.test(before)) return false
        const tr = view.state.tr.insertText(text, from, to).setMeta(slashKey, { from, query: '' })
        view.dispatch(tr)
        return true
      },
      handleKeyDown(view, event) {
        if (!getSlash(view.state)) return false
        if (event.key === 'Escape') {
          closeSlash(view)
          return true
        }
        return options.onKey(event)
      },
    },
    view() {
      let last: SlashState | null = null
      return {
        update(view) {
          const current = getSlash(view.state)
          if (current?.from === last?.from && current?.query === last?.query) return
          last = current
          options.onChange(current, view)
        },
        destroy() {
          last = null
        },
      }
    },
  })
}
