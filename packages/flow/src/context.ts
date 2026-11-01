import type { FlowExportOptions, FlowImageOptions } from './export/draw'
import type { FlowTree } from './core/groups'
import { inject, type ComputedRef, type InjectionKey, type Ref, type ShallowRef } from 'vue'
import type { FlowMessages, FlowMessagesOverride } from './locale'
import type {
  FlowData,
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
import type { EdgeTypeSpec } from './core/edge-types'
import type { FlowExtension } from './core/extension'
import type { FlowMenuItem, FlowMenuTarget } from './core/menu'
import type { NodeTypeSpec } from './core/node-types'
import type { FlowTransaction, FlowTransactionMeta } from './core/transaction'

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
  /** Edge types besides the extensions'; they win over an extension's type of the same name. */
  edgeTypes?: EdgeTypeSpec<any>[]
  /** The type of edges without `type`, new ones included. `bezier` by default. */
  edgeType?: string
  /**
   * Below this zoom nodes are drawn as plain boxes with their names, which
   * keeps a large flow quick; see the `simple` slot. `0` never does. `0.4` by default.
   */
  simpleZoom?: number
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
  transaction: [tr: FlowTransaction]
  nodeClick: [node: FlowNode, event: MouseEvent]
  nodeDblclick: [node: FlowNode, event: MouseEvent]
  nodeContextmenu: [node: FlowNode, event: MouseEvent]
  edgeClick: [edge: FlowDocument['edges'][number], event: MouseEvent]
  edgeContextmenu: [edge: FlowDocument['edges'][number], event: MouseEvent]
  /** Clicking the empty canvas; `point` is in canvas coordinates. */
  canvasClick: [point: Point, event: MouseEvent]
  /**
   * Right click or long press on the empty canvas. The context menu events
   * come before the editor's own menu; `event.preventDefault()` keeps it closed.
   */
  canvasContextmenu: [point: Point, event: MouseEvent]
  /** An edge was drawn, or moved to another port. */
  connect: [edge: FlowDocument['edges'][number]]
  /**
   * A new edge was dropped on empty canvas; `point` is where, in canvas
   * coordinates. The editor then offers the node types that can take the
   * edge; `event.preventDefault()` handles it yourself instead.
   */
  connectToCanvas: [from: Required<FlowEndpoint>, point: Point, event: MouseEvent]
}

export interface FlowEditorExpose {
  /** Applies changes as one transaction, one undo step. */
  transact: (fn: (tr: FlowTransaction) => void, meta?: FlowTransactionMeta) => FlowTransaction
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
   * The flow as an SVG document, as it looks now: every node and edge, what
   * is in view, or the selected ones (it throws when nothing is selected). Colors are written as `rgb(…)`, `rgba(…)` or `#rrggbb`, so
   * vector editors read them; nodes are drawn by their type's `draw`.
   */
  exportSVG: (options?: FlowExportOptions) => string
  /** The flow as a PNG image, with images embedded where their address can be read. */
  exportPNG: (options?: FlowImageOptions) => Promise<Blob>
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
  /**
   * Adds a node of a type with its defaults and selects it, as one undo
   * step; returns its id. See `FlowInsertOptions` for where it goes.
   */
  insertNode: (type: string, options?: FlowInsertOptions) => string | null
  /**
   * Starts dragging a new node of a type from `event`, a `pointerdown` on
   * any element on the page; letting go over the canvas adds it there, and
   * Escape cancels. The click that ends a drag is stopped. Returns `false`
   * when nothing was started.
   */
  startInsertDrag: (type: string, event: PointerEvent) => boolean
  /** Node types with a `palette` entry, in the order they were given. */
  readonly paletteTypes: NodeTypeSpec[]
  /** Selects an edge and opens the text field on its label. */
  editLabel: (id: string) => void
  /**
   * Puts nodes, the selected ones by default, into a new container of
   * `type` (`'group'` by default) drawn around them, as one undo step;
   * returns its id, or `null` when nothing was grouped.
   */
  groupNodes: (ids?: string[], type?: string) => string | null
  /** Removes a container and keeps the nodes inside, as one undo step. */
  ungroupNode: (id: string) => boolean
  /**
   * Takes nodes, the selected ones by default, out of their groups and puts
   * them just below, as one undo step; returns how many moved.
   */
  leaveGroup: (ids?: string[]) => number
}

export interface FlowEditorSlots {
  /** Panels over the canvas, e.g. `DouFlowControls`. */
  default?: () => unknown
  /** What follows the pointer while a new node is dragged in. */
  ghost?: (props: { spec: NodeTypeSpec; over: boolean }) => unknown
  /** Replaces the list offered when an edge is dropped on the empty canvas. */
  quickAdd?: (props: {
    types: NodeTypeSpec[]
    choose: (type: string) => void
    close: () => void
  }) => unknown
  /** A node's content while zoomed out past `simple-zoom`; its name by default. */
  simple?: (props: { node: FlowNode }) => unknown
}

export interface FlowInsertOptions {
  /**
   * Where the node goes, in canvas coordinates: its centre, or with `from`,
   * the port that takes the edge. Without it the node goes after the one
   * selected node, connected to it when it can be, or else in the middle
   * of the view; either way clear of other nodes.
   */
  at?: Point
  /** Connect the new node to this port, through the first port that can take it. */
  from?: Required<FlowEndpoint>
  /** Move focus to the new node, so keys such as undo act on it. `true` by default. */
  focus?: boolean
  /** Merged over the type's `defaults()`. */
  data?: FlowData
  /** The node's size instead of the type's `size`. */
  size?: { width?: number; height?: number }
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

/** What `previewNode` can show changed: the box, and the data. */
export type FlowNodePreview = Partial<Pick<FlowNode, 'x' | 'y' | 'width' | 'height' | 'data'>>

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
  exportSVG: FlowEditorExpose['exportSVG']
  exportPNG: FlowEditorExpose['exportPNG']
  tidy: FlowEditorExpose['tidy']
  centerNode: FlowEditorExpose['centerNode']
  /** Says `text` to screen readers. */
  announce: (text: string) => void
  /** The editor's size on screen, in px. */
  size: Ref<{ width: number; height: number }>
  selectedNodes: ComputedRef<Set<string>>
  insertNode: FlowEditorExpose['insertNode']
  /** Node types with a `palette` entry, in the order they were given. */
  paletteTypes: ComputedRef<NodeTypeSpec[]>
  startInsertDrag: FlowEditorExpose['startInsertDrag']
  editLabel: FlowEditorExpose['editLabel']
  groupNodes: FlowEditorExpose['groupNodes']
  ungroupNode: FlowEditorExpose['ungroupNode']
  leaveGroup: FlowEditorExpose['leaveGroup']
  /** Which node is inside which, from the nodes' `parent`. */
  tree: ComputedRef<FlowTree>
  /** Whether the node's type can hold other nodes. */
  isContainer: (node: FlowNode) => boolean
  /**
   * While nodes are moved or resized, or an edge is bent: the document
   * changes on every frame until the pointer is let go.
   */
  gesturing: ComputedRef<boolean>
  /**
   * Shows a node as if `patch` were applied, without changing the document:
   * its frame, ports, edges and `getNodeRect` all follow. For handles that
   * change the document once, when let go; `null` shows it as it is again,
   * and must be passed when the drag ends or is cancelled. `patch.data`
   * replaces the node's data, it is not merged. Only this editor shows it:
   * peers see the change once it is committed. A preview is dropped when
   * its node leaves the document.
   */
  previewNode: (id: string, patch: FlowNodePreview | null) => void
  /** The edge being drawn, as an SVG path in canvas coordinates. */
  connectingPath: ComputedRef<string | null>
  /** The editor's element. */
  root: Readonly<ShallowRef<HTMLElement | null>>
  /**
   * Opens the context menu for a target at a point on screen; `false` when
   * no extension has items for it. Pass the button that opens it as `from`:
   * the menu then opens below the button instead of at the point, or above
   * it when there is no room, and pressing the button again closes it.
   */
  openMenu: (target: FlowMenuTarget, client: Point, from?: Element) => boolean
  /** The items the context menu has for a target, as `openMenu` shows them. */
  menuItems: (target: FlowMenuTarget) => FlowMenuItem[]
  /**
   * Opens the editor's menu with these items, e.g. the choices behind a
   * toolbar button; `from` works as in `openMenu`.
   */
  showMenu: (
    items: FlowMenuItem[],
    client: Point,
    from?: Element,
    options?: { focusChecked?: boolean },
  ) => boolean
  /** The element that opened the menu, while it is open, e.g. to mark a button expanded. */
  menuFrom: Readonly<ShallowRef<Element | null>>
  toCanvas: (point: Point) => Point
  /** Copies the selected nodes to the clipboard; `false` when none are selected. */
  copy: () => boolean
  cut: () => boolean
  /** Pastes what was copied, at `at` (canvas coordinates) or next to the original. */
  paste: (at?: Point) => Promise<boolean>
  /** Adds a copy of the selected nodes next to them. */
  duplicate: () => void
  /** Deletes the selected nodes and edges, except locked nodes. */
  deleteSelection: () => void
  selectAll: () => void
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
