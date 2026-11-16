import type {
  FlowCommentAnchor,
  FlowDocument,
  FlowEdge,
  FlowExtension,
  FlowNode,
} from '@dou-ui/flow'
import type { Node as PMNode } from 'prosemirror-model'
import type { BlockCommentAnchor, BlockCommentsSpec } from '../core/comments'
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
  /** When the extensions offer no node to add, offer one with ports (not on a whiteboard, which has its tools). */
  fallbackNode: boolean
  /** Threads can be started and shown on the nodes and edges, with the document's comments. */
  commentable: boolean
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

/** A block's `height` prop in px: the default when it isn't a positive number. */
export const heightOf = (value: unknown, fallback: number) =>
  typeof value === 'number' && value > 0 ? clampHeight(value) : fallback

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** What `checkDocument` reports of a block's props: a board or height it would read differently. */
export function checkBoardProps(props: Record<string, unknown>) {
  const problems: { prop: string; message: string }[] = []
  const { board, height } = props
  if (board != null) {
    if (!isObject(board))
      problems.push({
        prop: 'board',
        message: 'The board is not a flow document; it would be shown empty',
      })
    else
      for (const list of ['nodes', 'edges'] as const) {
        const items = board[list]
        if (items === undefined) continue
        if (!Array.isArray(items))
          problems.push({
            prop: `board.${list}`,
            message: `"${list}" is not a list; it would be read as empty`,
          })
        else if (items.some((item) => !isObject(item)))
          problems.push({
            prop: `board.${list}`,
            message: `Some ${list} are not objects; they would be left out`,
          })
      }
  }
  if (height != null && !(typeof height === 'number' && height > 0))
    problems.push({
      prop: 'height',
      message: `The height ${JSON.stringify(height)} is not a positive number; the default would be used`,
    })
  else if (typeof height === 'number' && (height < BOARD_HEIGHT.min || height > BOARD_HEIGHT.max))
    problems.push({
      prop: 'height',
      message: `The height ${height} is outside ${BOARD_HEIGHT.min}–${BOARD_HEIGHT.max}; it would be clamped`,
    })
  return problems
}

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

/**
 * Where a thread is on a board, as the flow editor's `getCommentAnchors`
 * gives it: a node, maybe a point on it with its number there, or an edge.
 */
export type BoardCommentTarget = FlowCommentAnchor

const threadIds = (item: { comments?: unknown }): string[] =>
  Array.isArray(item.comments) ? item.comments.filter((id) => typeof id === 'string') : []

/** What a node shows: its label, or a whiteboard shape's text. */
const textOf = (data: Record<string, unknown> | undefined) => {
  const text = data?.label ?? data?.text
  return typeof text === 'string' ? text : ''
}

const pinOf = (node: FlowNode, id: string) => {
  const pins = node.commentPins
  const at = isObject(pins) && Object.hasOwn(pins, id) ? pins[id] : null
  return isObject(at) && typeof at.x === 'number' && typeof at.y === 'number'
    ? { x: at.x, y: at.y }
    : null
}

/** `comments` (and `commentPins`) of a node or edge with only the ids `keep` says yes to. */
function keepOn<T extends FlowNode | FlowEdge>(item: T, keep: (id: string) => boolean): T {
  const ids = threadIds(item)
  const kept = ids.filter(keep)
  const pins = 'commentPins' in item && isObject(item.commentPins) ? item.commentPins : null
  const keptPins = pins ? Object.fromEntries(Object.entries(pins).filter(([id]) => keep(id))) : null
  if (
    kept.length === ids.length &&
    (!pins || Object.keys(keptPins!).length === Object.keys(pins).length)
  )
    return item
  const { comments: _, commentPins: __, ...rest } = item as FlowNode
  const next = { ...rest } as T
  if (kept.length) next.comments = kept
  if (keptPins && Object.keys(keptPins).length) (next as FlowNode).commentPins = keptPins
  return next
}

/**
 * How a board block keeps comment threads: on its nodes and edges, in their
 * `comments` (and `commentPins`), as a `DouFlowEditor` does.
 */
export const boardComments: BlockCommentsSpec<BoardCommentTarget> = {
  anchors(props) {
    const board = boardOf(props.board)
    const anchors: Record<string, BlockCommentAnchor<BoardCommentTarget>> = {}
    for (const node of board.nodes) {
      // pins are numbered on the node in the order they were made, from 1
      let number = 0
      for (const id of threadIds(node)) {
        const at = pinOf(node, id)
        anchors[id] = {
          text: textOf(node.data),
          target: at ? { node: node.id, at, number: ++number } : { node: node.id },
        }
      }
    }
    for (const edge of board.edges)
      for (const id of threadIds(edge))
        anchors[id] ??= { text: edge.label ?? '', target: { edge: edge.id } }
    return anchors
  },
  place(props, id, target) {
    const board = boardOf(props.board)
    const add = (ids: string[]) => [...ids.filter((other) => other !== id), id]
    if ('node' in target) {
      if (!board.nodes.some((node) => node.id === target.node)) return null
      const nodes = board.nodes.map((node) => {
        if (node.id !== target.node) return node
        const next: FlowNode = { ...node, comments: add(threadIds(node)) }
        if (target.at)
          next.commentPins = {
            ...(isObject(node.commentPins) ? node.commentPins : {}),
            [id]: target.at,
          }
        return next
      })
      return { ...props, board: { ...board, nodes } }
    }
    if (!board.edges.some((edge) => edge.id === target.edge)) return null
    const edges = board.edges.map((edge) =>
      edge.id === target.edge ? { ...edge, comments: add(threadIds(edge)) } : edge,
    )
    return { ...props, board: { ...board, edges } }
  },
  strip(props, keep) {
    if (props.board == null) return props
    const board = boardOf(props.board)
    const nodes = board.nodes.map((node) => keepOn(node, keep))
    const edges = board.edges.map((edge) => keepOn(edge, keep))
    const same =
      nodes.every((node, i) => node === board.nodes[i]) &&
      edges.every((edge, i) => edge === board.edges[i])
    return same ? props : { ...props, board: { ...board, nodes, edges } }
  },
}
