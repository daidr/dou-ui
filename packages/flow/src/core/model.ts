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
  /** `'bezier'` when left out. */
  type?: string
  label?: string
  data?: Data
}

export interface FlowDocument {
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
}

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

export const emptyDocument = (): FlowDocument => ({ nodes: [], edges: [] })
export const emptySelection = (): FlowSelection => ({ nodes: [], edges: [] })

let counter = 0

/** A short id, unique within this page and very likely across clients. */
export function createId(prefix = 'n') {
  counter = (counter + 1) % 1296
  const time = Date.now().toString(36).slice(-5)
  const random = Math.random().toString(36).slice(2, 6)
  return `${prefix}${time}${counter.toString(36).padStart(2, '0')}${random}`
}
