import type { Node as PMNode } from 'prosemirror-model'
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import * as Y from 'yjs'
import { blockAround, findBlockById } from '../core/blocks'
import type { Binding, YBlock } from './binding'
import { cellAt, cellStart } from './table'

/** What the editor needs of a Yjs awareness instance (`y-protocols/awareness`). */
export interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | null
  setLocalStateField(field: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: 'change', listener: (...args: unknown[]) => void): void
  off(event: 'change', listener: (...args: unknown[]) => void): void
}

/** A place in the text: the block and a position in its text that follows edits. */
export interface EditorPresencePlace {
  block: string
  /** In a table: the cell, `row id:column id`. */
  cell?: string
  /** A Yjs relative position as JSON (`Y.relativePositionToJSON`). */
  position: unknown
}
type Place = EditorPresencePlace

/**
 * Where a person's cursor is, shared in the awareness field `editor`
 * (`null` when they have none). The selection runs from `anchor` to
 * `head`; the cursor with the name is drawn at `head`.
 */
export interface EditorPresence {
  anchor: EditorPresencePlace
  head: EditorPresencePlace
}
type Cursor = EditorPresence

/** The text a place points into: the block's own, or one of its table cells. */
function textOf(map: Y.Map<unknown>, block: string, cell?: string): Y.Text | undefined {
  const yblock = map.get(block)
  if (!(yblock instanceof Y.Map)) return undefined
  if (!cell) {
    // a table's text is in its cells
    if ((yblock as YBlock).has('cells')) return undefined
    const text = (yblock as YBlock).get('text')
    return text instanceof Y.Text ? text : undefined
  }
  const cells = (yblock as YBlock).get('cells')
  const text = cells instanceof Y.Map ? cells.get(cell) : undefined
  return text instanceof Y.Text ? text : undefined
}

/** A place in a block's text, given without an editor. */
export interface EditorCursorTarget {
  block: string
  /** In a table: the cell, `row id:column id`. */
  cell?: string
  /**
   * Where in the text: the number of characters before it (UTF-16 code
   * units, as `string.length` counts them; an inline node such as a mention
   * counts as one). Kept within the text; left out, its end.
   */
  offset?: number
}

/** Whether blocks of a stored type hold text of their own, e.g. not an image or a divider. */
export type HoldsText = (type: string) => boolean

function placeAt(
  map: Y.Map<unknown>,
  target: EditorCursorTarget,
  holdsText: HoldsText,
): Place | null {
  const yblock = map.get(target.block)
  if (!target.cell && yblock instanceof Y.Map && !holdsText(String(yblock.get('type')))) return null
  const text = textOf(map, target.block, target.cell)
  if (!text) return null
  const offset = Math.max(0, Math.min(Math.floor(target.offset ?? text.length), text.length))
  const position = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, offset))
  return target.cell
    ? { block: target.block, cell: target.cell, position }
    : { block: target.block, position }
}

/** A cursor at `head`, selecting from `anchor`; `null` when either has no text to be in. */
export function cursorIn(
  map: Y.Map<unknown>,
  head: EditorCursorTarget,
  anchor: EditorCursorTarget,
  holdsText: HoldsText,
): EditorPresence | null {
  const to = placeAt(map, head, holdsText)
  const from = anchor === head ? to : placeAt(map, anchor, holdsText)
  return to && from ? { anchor: from, head: to } : null
}

/** A document position as a place that survives other people's edits. */
export function placeOf(binding: Binding, doc: PMNode, pos: number): Place | null {
  const info = blockAround(doc.resolve(pos))
  if (!info) return null
  const id = info.node.attrs.id as string
  let index = pos - info.contentPos - 1
  let cell: string | undefined
  if (info.content.type.spec.rows) {
    const found = cellAt(info.content, index)
    if (!found) return null
    cell = found.key
    index = found.index
  }
  const text = textOf(binding.map as Y.Map<unknown>, id, cell)
  if (!text) return null
  const offset = Math.max(0, Math.min(index, text.length))
  const position = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, offset))
  return cell ? { block: id, cell, position } : { block: id, position }
}

/** Back from a place to a document position, or `null` if its block is gone. */
export function positionOf(binding: Binding, doc: PMNode, place: Place): number | null {
  const info = findBlockById(doc, place.block)
  if (!info) return null
  const absolute = Y.createAbsolutePositionFromRelativePosition(
    Y.createRelativePositionFromJSON(place.position),
    binding.map.doc!,
  )
  let start = info.contentPos + 1
  let size = info.content.content.size
  if (place.cell) {
    const cell = info.content.type.spec.rows ? cellStart(info.content, place.cell) : null
    if (!cell) return null
    start += cell.offset
    size = cell.size
  }
  const offset =
    absolute && textOf(binding.map as Y.Map<unknown>, place.block, place.cell) === absolute.type
      ? Math.min(absolute.index, size)
      : 0
  return start + offset
}

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

const cursorsKey = new PluginKey<DecorationSet>('dou-editor-cursors')

function decorations(binding: Binding, awareness: AwarenessLike, state: EditorState) {
  const found: Decoration[] = []
  awareness.getStates().forEach((value, client) => {
    if (client === awareness.clientID) return
    const cursor = value.editor as Cursor | null | undefined
    const user = value.user as { name?: string; color?: string } | undefined
    if (!cursor) return
    const anchor = positionOf(binding, state.doc, cursor.anchor)
    const head = positionOf(binding, state.doc, cursor.head)
    if (anchor === null || head === null) return
    const shown = { name: user?.name ?? '', color: user?.color ?? '#6b7280' }
    found.push(
      Decoration.widget(head, () => cursorElement(shown), {
        key: `cursor-${client}-${shown.name}-${shown.color}`,
        side: 10,
      }),
    )
    if (anchor !== head) {
      found.push(
        Decoration.inline(Math.min(anchor, head), Math.max(anchor, head), {
          class: 'dou-editor__remote-selection',
          style: `--dou-editor-cursor-color: ${shown.color}`,
        }),
      )
    }
  })
  return DecorationSet.create(state.doc, found)
}

/** Shares this user's cursor and shows everyone else's. */
export function cursorsPlugin(binding: Binding, awareness: AwarenessLike): Plugin {
  return new Plugin<DecorationSet>({
    key: cursorsKey,
    state: {
      init: (_config, state) => decorations(binding, awareness, state),
      apply(tr, value, _old, state) {
        if (tr.docChanged || tr.getMeta(cursorsKey)) return decorations(binding, awareness, state)
        return value
      },
    },
    props: {
      decorations(state) {
        return cursorsKey.getState(state)
      },
    },
    view(view) {
      let scheduled = false
      // others' cursors changed: redraw on the next frame, never inside a dispatch
      const onChange = () => {
        if (scheduled) return
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          if (binding.view === view) view.dispatch(view.state.tr.setMeta(cursorsKey, true))
        })
      }
      awareness.on('change', onChange)
      let last = ''
      const share = () => {
        let cursor: Cursor | null = null
        if (view.hasFocus()) {
          const { anchor, head } = view.state.selection
          const a = placeOf(binding, view.state.doc, anchor)
          const h = placeOf(binding, view.state.doc, head)
          if (a && h) cursor = { anchor: a, head: h }
        }
        const json = JSON.stringify(cursor)
        if (json === last) return
        last = json
        awareness.setLocalStateField('editor', cursor)
      }
      const onFocus = () => share()
      view.dom.addEventListener('focus', onFocus)
      view.dom.addEventListener('blur', onFocus)
      return {
        update: share,
        destroy() {
          awareness.off('change', onChange)
          view.dom.removeEventListener('focus', onFocus)
          view.dom.removeEventListener('blur', onFocus)
          awareness.setLocalStateField('editor', null)
        },
      }
    },
  })
}
