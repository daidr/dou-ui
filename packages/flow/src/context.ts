import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { FlowMessages } from './locale'
import type {
  FlowDocument,
  FlowNode,
  FlowPortSpec,
  FlowSelection,
  FlowViewport,
  Point,
  PortSide,
  Rect,
} from './core/model'
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
  registerPort: (id: string, el: HTMLElement, auto?: boolean) => void
  unregisterPort: (id: string, auto?: boolean) => void
}

export const flowNodeKey: InjectionKey<FlowNodeContext> = Symbol('dou-flow-node')
