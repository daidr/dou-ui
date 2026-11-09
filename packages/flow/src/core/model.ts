/*
 * The document a flow editor edits: plain, serialisable data, bound with
 * `v-model`. Positions are canvas coordinates in px, from the top left of a
 * node. Ports are not stored; a node type declares them, and edges refer to
 * them by id.
 */

export type FlowData = Record<string, unknown>

export interface FlowNode<Data extends FlowData = FlowData> {
  id: string
  /** A registered node type; `'default'` when left out. */
  type?: string
  x: number
  y: number
  /** Only stored for nodes that can be resized; otherwise the content decides. */
  width?: number
  height?: number
  data?: Data
  /** A locked node cannot be moved or deleted. */
  locked?: boolean
  /**
   * The container node, e.g. a group, this node sits in. Its `x` and `y`
   * stay canvas coordinates; moving the container moves it along.
   */
  parent?: string
  /**
   * Stacking order among nodes that aren't containers: higher is drawn on
   * top. Nodes without it count as `0`; equal ones keep the document order.
   */
  z?: number
  /**
   * The ids of the comment threads about this node, see the editor's
   * `comments`. Kept when the node is deleted and brought back by undo.
   */
  comments?: string[]
  /**
   * Where on the node each pinned thread is, by thread id: `x` and `y` are
   * fractions of the node's width and height from its top left, 0 to 1, so
   * a pin moves and scales with the node. The ids are in `comments` too.
   */
  commentPins?: Record<string, Point>
}

export interface FlowEndpoint {
  node: string
  /** Leave out to attach to the node itself. */
  port?: string
}

export interface FlowEdge<Data extends FlowData = FlowData> {
  id: string
  source: FlowEndpoint
  target: FlowEndpoint
  /** The edge type: `bezier`, `step`, `straight` or one added by an extension. The editor's `edge-type` when left out. */
  type?: string
  /** Text shown on the edge. */
  label?: string
  /** Dashes run along the edge in its direction, e.g. while data flows through it. */
  animated?: boolean
  /**
   * Points on the canvas the edge runs through on its way, in order. Tidying
   * sets them on an edge that spans several ranks, so it passes between
   * the nodes in its way; moving either end clears them.
   */
  points?: Point[]
  data?: Data
  /** The ids of the comment threads about this edge, see the editor's `comments`. */
  comments?: string[]
}

export interface FlowDocument {
  /** The version of the format; see `migrateDocument`. */
  version: 1
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export type PortSide = 'left' | 'right' | 'top' | 'bottom'

export interface FlowPortSpec {
  id: string
  /** Inputs receive edges, outputs start them. */
  kind: 'input' | 'output'
  /** Where the port sits; inputs default to the left, outputs to the right. */
  side?: PortSide
  label?: string
  /** What the port carries. Two ports connect when they share a type, or either is `'any'`. */
  dataType?: string | string[]
  /**
   * The most edges the port takes. Inputs take one by default, outputs any
   * number. A new edge on a full port replaces its oldest edge.
   */
  max?: number
  /**
   * When the port shows: `always`; `hover`, on a hovered or selected node,
   * or one with the keyboard focus in it (a field being typed in);
   * or `connecting`, only while an edge is drawn. A `<DouFlowPort visible>`
   * overrides it. Defaults to `always`.
   */
  visible?: FlowPortVisible
}

/** When a port shows, see `FlowPortSpec.visible`. */
export type FlowPortVisible = 'always' | 'hover' | 'connecting'

/** Where the canvas is shown: `x` and `y` are the screen offset of the canvas origin. */
export interface FlowViewport {
  x: number
  y: number
  zoom: number
}

export interface FlowSelection {
  nodes: string[]
  edges: string[]
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const emptyDocument = (): FlowDocument => ({ version: 1, nodes: [], edges: [] })
export const emptySelection = (): FlowSelection => ({ nodes: [], edges: [] })

let counter = 0

/** A short id, unique within this page and very likely across clients. */
export function createId(prefix = 'n') {
  counter = (counter + 1) % 1296
  const time = Date.now().toString(36).slice(-5)
  const random = Math.random().toString(36).slice(2, 6)
  return `${prefix}${time}${counter.toString(36).padStart(2, '0')}${random}`
}
