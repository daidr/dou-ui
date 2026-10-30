import { Plugin, PluginKey, TextSelection, type EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

/** Someone (or something) that can be mentioned. */
export interface MentionItem {
  /** Stored in the document. */
  id: string
  /** Shown after the `@`, and stored too so the mention reads without a lookup. */
  label: string
  /** A second line in the suggestions, e.g. a team or an email. */
  description?: string
  /** An image shown in the suggestions. */
  avatar?: string
}

/** The suggestions: open from the `@` at `from` to the cursor, with what was typed as the query. */
export interface MentionState {
  from: number
  query: string
  items: MentionItem[]
  active: number
}

interface MentionMeta {
  open?: number
  close?: true
  items?: MentionItem[]
  active?: number
}

export const mentionKey = new PluginKey<MentionState | null>('dou-editor-mention')

const TRIGGER = '@'
const MAX_QUERY = 32

export function getMention(state: EditorState | null): MentionState | null {
  return state ? (mentionKey.getState(state) ?? null) : null
}

function setMeta(view: EditorView, meta: MentionMeta) {
  view.dispatch(view.state.tr.setMeta(mentionKey, meta).setMeta('addToHistory', false))
}

export const closeMention = (view: EditorView) => setMeta(view, { close: true })
export const setMentionItems = (view: EditorView, items: MentionItem[]) => setMeta(view, { items })
export const setMentionActive = (view: EditorView, active: number) => setMeta(view, { active })

/** Replace the `@query` with a mention and a space after it. */
export function chooseMention(view: EditorView, item: MentionItem) {
  const current = getMention(view.state)
  if (!current) return
  const type = view.state.schema.nodes.mention!
  const { head } = view.state.selection
  const tr = view.state.tr.replaceWith(current.from, head, [
    type.create({ id: item.id, label: item.label }),
    view.state.schema.text(' '),
  ])
  tr.setSelection(TextSelection.create(tr.doc, current.from + 2))
  view.dispatch(tr.setMeta(mentionKey, { close: true } satisfies MentionMeta).scrollIntoView())
  view.focus()
}

export function mentionPlugin(): Plugin<MentionState | null> {
  let opening: number | null = null
  return new Plugin<MentionState | null>({
    key: mentionKey,
    // the browser types the `@` itself; the suggestions open once it is in
    appendTransaction(_trs, _old, state) {
      if (opening === null) return null
      const from = opening
      opening = null
      if (state.doc.textBetween(from, from + 1) !== TRIGGER) return null
      return state.tr.setMeta(mentionKey, { open: from } satisfies MentionMeta)
    },
    state: {
      init: () => null,
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(mentionKey) as MentionMeta | undefined
        if (meta?.close) return null
        if (meta?.open !== undefined) return { from: meta.open, query: '', items: [], active: 0 }
        if (!value) return null
        const from = tr.mapping.map(value.from)
        const { $head, empty } = state.selection
        // close when the cursor leaves the query, or the `@` is deleted
        if (!empty || $head.pos <= from || $head.pos - from > MAX_QUERY + 1) return null
        if (!state.doc.resolve(from).sameParent($head)) return null
        const text = state.doc.textBetween(from, $head.pos, '\n', '\n')
        if (text[0] !== TRIGGER) return null
        const query = text.slice(1)
        if (/\s/.test(query)) return null
        let { items, active } = value
        if (meta?.items) {
          items = meta.items
          active = 0
        }
        if (meta?.active !== undefined) active = meta.active
        if (
          from === value.from &&
          query === value.query &&
          items === value.items &&
          active === value.active
        )
          return value
        return { from, query, items, active }
      },
    },
    props: {
      handleTextInput(view, from, _to, text) {
        if (text !== TRIGGER || getMention(view.state)) return false
        const $from = view.state.doc.resolve(from)
        if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false
        const before = $from.parent.textBetween(0, $from.parentOffset, '', '￼')
        // not inside a word or an email address
        if (/[\w.+-]$/.test(before)) return false
        opening = from
        return false
      },
      handleKeyDown(view, event) {
        const current = getMention(view.state)
        if (!current || event.isComposing) return false
        const count = current.items.length
        switch (event.key) {
          case 'Escape':
            closeMention(view)
            return true
          case 'ArrowDown':
          case 'ArrowUp':
            if (!count) return false
            setMentionActive(
              view,
              (current.active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count,
            )
            return true
          case 'Enter':
          case 'Tab': {
            const item = current.items[current.active]
            if (!item) return false
            chooseMention(view, item)
            return true
          }
          default:
            return false
        }
      },
    },
  })
}
