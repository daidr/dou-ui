import type { FlowDocument, FlowExtension } from '@dou-ui/flow'
import type { Node as PMNode } from 'prosemirror-model'
import type { Label } from '../core/extension'
import type { FlowBlockEditorProps } from './index'

/** Sent to a block's element to open its fullscreen editor (`Enter` on the selected block). */
export const BOARD_OPEN_EVENT = 'dou-editor-board-open'

/** Heights a block may have in the document, in px. */
export const BOARD_HEIGHT = { min: 160, max: 1200, step: 40 }

export interface BoardBlockSettings {
  label: Label
  extensions: (FlowExtension | FlowExtension[])[]
  editorProps: FlowBlockEditorProps
  height: number
}

/** The items of a list that are objects. */
const objects = <T>(list: unknown) =>
  Array.isArray(list)
    ? (list.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as T[])
    : []

/**
 * A block's `board` prop as a flow document; one that is missing or not
 * shaped like one is read as an empty flow (nodes and edges that aren't
 * objects are left out).
 */
export function boardOf(value: unknown): FlowDocument {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<FlowDocument>)
      : {}
  return {
    ...source,
    version: 1,
    nodes: objects(source.nodes),
    edges: objects(source.edges),
  } as FlowDocument
}

export const clampHeight = (height: number) =>
  Math.round(Math.min(BOARD_HEIGHT.max, Math.max(BOARD_HEIGHT.min, height)))

interface Found {
  pos: number
  node: PMNode
}

const endOf = (at: Found) => at.pos + at.node.nodeSize
/** A content node's attributes besides the board. */
const restOf = (node: PMNode) => JSON.stringify({ ...node.attrs, board: null })

/**
 * Whether `a` and `b` differ only in the `board` prop of the block `id`:
 * an undo taken from the fullscreen editor must not change anything the
 * person can't see there.
 */
export function onlyBoardChanged(a: PMNode, b: PMNode, id: string): boolean {
  const find = (doc: PMNode) => {
    let found: Found | null = null
    doc.descendants((node, pos) => {
      if (found) return false
      if (node.type.name === 'block' && node.attrs.id === id) {
        found = { pos, node }
        return false
      }
      return true
    })
    return found as Found | null
  }
  const before = find(a)
  const after = find(b)
  if (!before || !after) return false
  if (!a.slice(0, before.pos).eq(b.slice(0, after.pos))) return false
  if (!a.slice(endOf(before)).eq(b.slice(endOf(after)))) return false
  const [x, y] = [before.node.firstChild!, after.node.firstChild!]
  if (x.type !== y.type) return false
  if (restOf(x) !== restOf(y)) return false
  // the children of the block, if any
  if (before.node.childCount !== after.node.childCount) return false
  return before.node.childCount < 2 || before.node.child(1).eq(after.node.child(1))
}
