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
interface Place {
  block: string
  /** In a table: the cell, `row id:column id`. */
  cell?: string
  position: unknown
}

/** The text a place points into: the block's own, or one of its table cells. */
function textOf(binding: Binding, block: string, cell?: string): Y.Text | undefined {
  const yblock = binding.map.get(block) as YBlock | undefined
  if (!cell) return yblock?.get('text') as Y.Text | undefined
  return (yblock?.get('cells') as Y.Map<Y.Text> | undefined)?.get(cell)
}

interface Cursor {
  anchor: Place
  head: Place
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
  const text = textOf(binding, id, cell)
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
    absolute && textOf(binding, place.block, place.cell) === absolute.type
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
    const cursor = value.cursor as Cursor | null | undefined
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
        awareness.setLocalStateField('cursor', cursor)
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
          awareness.setLocalStateField('cursor', null)
        },
      }
    },
  })
}
