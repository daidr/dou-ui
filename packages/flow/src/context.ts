import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { FlowMessages } from './locale'
import type {
  FlowDocument,
  FlowEndpoint,
  FlowNode,
  FlowPortSpec,
  FlowSelection,
  FlowViewport,
  Point,
  PortSide,
  Rect,
} from './core/model'
import type { FlowConnection, PortTypes, PortTypeSpec } from './core/connect'
import type { NodeTypeSpec } from './core/node-types'
import type { Transaction, TransactionMeta } from './core/transaction'

export interface FlowEditorProps {
  /** Registered node types; `default` is always available. */
  nodeTypes?: NodeTypeSpec<any>[]
  /** Grid step for snapping and arrow keys, in px. `0` turns snapping to the grid off. */
  grid?: number
  /** Line nodes up with their neighbours while dragging. */
  guides?: boolean
  minZoom?: number
  maxZoom?: number
  /** Fit all nodes into view once they are measured. */
  fitView?: boolean
  /** View, select and pan, but not change anything. */
  readonly?: boolean
  /** Scrolling pans the canvas; with Ctrl / ⌘ it zooms. Off, only Ctrl / ⌘ + scroll zooms. */
  panOnScroll?: boolean
  /** Looks and connection rules of port types, by the name used in `dataType`. */
  portTypes?: PortTypes
  /** Refuse edges that would close a cycle. */
  acyclic?: boolean
  /** The last check before an edge is made; return `false` to refuse it. */
  canConnect?: (connection: FlowConnection, doc: FlowDocument) => boolean
  /** Accessible name of the canvas. */
  label?: string
  messages?: Partial<FlowMessages>
}

export interface FlowEditorEmits {
  change: [tr: Transaction]
  'node-click': [node: FlowNode, event: MouseEvent]
  'node-dblclick': [node: FlowNode, event: MouseEvent]
  'node-contextmenu': [node: FlowNode, event: MouseEvent]
  'edge-click': [edge: FlowDocument['edges'][number], event: MouseEvent]
  'edge-contextmenu': [edge: FlowDocument['edges'][number], event: MouseEvent]
  /** Clicking the empty canvas; `point` is in canvas coordinates. */
  'canvas-click': [point: Point, event: MouseEvent]
  'canvas-contextmenu': [point: Point, event: MouseEvent]
  /** An edge was drawn, or moved to another port. */
  connect: [edge: FlowDocument['edges'][number]]
  /** A new edge was dropped on empty canvas; `point` is where, in canvas coordinates. */
  'connect-end': [from: Required<FlowEndpoint>, point: Point, event: MouseEvent]
}

export interface FlowEditorExpose {
  /** Applies changes as one transaction, one undo step. */
  transact: (fn: (tr: Transaction) => void, meta?: TransactionMeta) => Transaction
  undo: () => boolean
  redo: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Shows all nodes, or the given ones. */
  fit: (ids?: string[]) => void
  zoomTo: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  /** Centers a node in view without changing the zoom. */
  centerNode: (id: string) => void
  /** Converts a point on screen (client coordinates) to canvas coordinates. */
  toCanvas: (point: Point) => Point
  /** A node's measured box in canvas coordinates. */
  getNodeRect: (id: string) => Rect | null
}

/** Where a port's centre is, from its node's top left corner. */
export interface PortAnchor extends Point {
  side: PortSide
}

export interface NodeMetrics {
  width: number
  height: number
  ports: Map<string, PortAnchor>
}

/** How a port shows while an edge is being drawn. */
export type PortState = 'active' | 'valid' | 'candidate'

export interface FlowEditorContext {
  doc: Ref<FlowDocument>
  selection: Ref<FlowSelection>
  viewport: Ref<FlowViewport>
  readonly: ComputedRef<boolean>
  messages: ComputedRef<FlowMessages>
  minZoom: ComputedRef<number>
  maxZoom: ComputedRef<number>
  transact: FlowEditorExpose['transact']
  undo: () => boolean
  redo: () => boolean
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  fit: FlowEditorExpose['fit']
  zoomTo: FlowEditorExpose['zoomTo']
  zoomIn: () => void
  zoomOut: () => void
  /** The registered type of a port, if any. */
  portTypeOf: (port: FlowPortSpec) => PortTypeSpec | undefined
  /** A port type's color as CSS. */
  colorOf: (spec: PortTypeSpec | undefined) => string | undefined
}

export const flowEditorKey: InjectionKey<FlowEditorContext> = Symbol('dou-flow-editor')

/** The surrounding flow editor; for controls and panels placed in its default slot. */
export function useFlowEditor() {
  const context = inject(flowEditorKey, null)
  if (!context) throw new Error('[dou-ui] useFlowEditor() must be used inside <DouFlowEditor>')
  return context
}

export interface FlowNodeContext {
  node: ComputedRef<FlowNode>
  ports: ComputedRef<FlowPortSpec[]>
  /** Port ids with at least one edge. */
  connected: ComputedRef<Set<string>>
  /** While an edge is being drawn, how each port shows; `null` otherwise. */
  portStates: ComputedRef<Map<string, PortState> | null>
  registerPort: (id: string, el: HTMLElement, auto?: boolean) => void
  unregisterPort: (id: string, auto?: boolean) => void
}

export const flowNodeKey: InjectionKey<FlowNodeContext> = Symbol('dou-flow-node')
