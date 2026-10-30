import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { FlowMessages, FlowMessagesOverride } from './locale'
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
import type { FlowExtension } from './core/extension'
import type { NodeTypeSpec } from './core/node-types'
import type { Transaction, TransactionMeta } from './core/transaction'

export type FlowPanelPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface FlowControlsProps {
  /** Corner of the editor to sit in. */
  placement?: FlowPanelPlacement
  /** Show undo and redo. */
  history?: boolean
  /** Show the tidy button, which lays the nodes out along their edges. */
  tidy?: boolean
}

export interface FlowMinimapProps {
  /** Corner of the editor to sit in. */
  placement?: FlowPanelPlacement
  /** Size of the map in px. */
  width?: number
  height?: number
}

export interface FlowEditorProps {
  /**
   * What the editor is made of: node types, port types, rules, keys and
   * layers. `flowKit()` by default.
   */
  extensions?: (FlowExtension | FlowExtension[])[]
  /** Node types besides the extensions'; they win over an extension's type of the same name. */
  nodeTypes?: NodeTypeSpec<any>[]
  /** Grid step for snapping and arrow keys, in px. `0` turns snapping to the grid off. */
  grid?: number
  /** Line nodes up with their neighbours while dragging. */
  guides?: boolean
  minZoom?: number
  maxZoom?: number
  /**
   * Which way the flow runs: `horizontal` left to right, `vertical` top to
   * bottom. Tidying lays nodes out this way.
   */
  direction?: 'horizontal' | 'vertical'
  /** Fit all nodes into view once they are measured. */
  fitView?: boolean
  /**
   * The furthest `fit-view` zooms out, so text stays readable; a larger flow
   * starts at its top left and is panned to. `0` always fits everything.
   */
  fitMinZoom?: number
  /** View, select and pan, but not change anything. */
  readonly?: boolean
  /** Scrolling pans the canvas; with Ctrl / ⌘ it zooms. Off, only Ctrl / ⌘ + scroll zooms. */
  panOnScroll?: boolean
  /** Looks and connection rules of port types, by the name used in `dataType`. */
  portTypes?: PortTypes
  /** Refuse edges that would close a cycle. */
  acyclic?: boolean
  /**
   * The last check before an edge is made. Return `false` to refuse it, or a
   * sentence saying why. Called for every port while an edge is dragged.
   */
  canConnect?: (connection: FlowConnection, doc: FlowDocument) => boolean | string
  /** Accessible name of the canvas. */
  ariaLabel?: string
  /** Texts to change; only the ones given are replaced. */
  messages?: FlowMessagesOverride
}

export interface FlowEditorEmits {
  /** Every change to the document, with its steps; `update:modelValue` follows. */
  transaction: [tr: Transaction]
  nodeClick: [node: FlowNode, event: MouseEvent]
  nodeDblclick: [node: FlowNode, event: MouseEvent]
  nodeContextmenu: [node: FlowNode, event: MouseEvent]
  edgeClick: [edge: FlowDocument['edges'][number], event: MouseEvent]
  edgeContextmenu: [edge: FlowDocument['edges'][number], event: MouseEvent]
  /** Clicking the empty canvas; `point` is in canvas coordinates. */
  canvasClick: [point: Point, event: MouseEvent]
  canvasContextmenu: [point: Point, event: MouseEvent]
  /** An edge was drawn, or moved to another port. */
  connect: [edge: FlowDocument['edges'][number]]
  /** A new edge was dropped on empty canvas; `point` is where, in canvas coordinates. */
  connectToCanvas: [from: Required<FlowEndpoint>, point: Point, event: MouseEvent]
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
  /**
   * Lays nodes out in columns along their edges, as one undo step: the given
   * ones, the selection when two or more nodes are selected, or all.
   */
  tidy: (ids?: string[]) => void
  /**
   * Ids of edges whose ports no longer fit: a port is gone, or the types of
   * its two ends don't match any more. They are drawn red and dashed.
   */
  readonly staleEdges: string[]
  /** Removes the stale edges as one undo step; returns how many. */
  removeStaleEdges: () => number
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
export type PortState = 'active' | 'valid' | 'candidate' | 'refused'

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
  getNodeRect: FlowEditorExpose['getNodeRect']
  tidy: FlowEditorExpose['tidy']
  centerNode: FlowEditorExpose['centerNode']
  /** Says `text` to screen readers. */
  announce: (text: string) => void
  /** The editor's size on screen, in px. */
  size: Ref<{ width: number; height: number }>
  selectedNodes: ComputedRef<Set<string>>
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
