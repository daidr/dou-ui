import type { Component } from 'vue'
import type { Size, Tone } from '../../utils/types'

/** `blocked` is in progress while something it depends on is not finished. */
export type FlowNodeStatus = 'wait' | 'process' | 'finish' | 'error' | 'blocked'
/** A `milestone` shows a flag in place of the status dot. */
export type FlowNodeKind = 'task' | 'milestone'
export type FlowNodeShape = 'pill' | 'card'
export type FlowGraphSize = Size

export interface FlowNode {
  id: string
  label: string
  kind?: FlowNodeKind
  status?: FlowNodeStatus
  /** An icon before the label. */
  icon?: Component
  /** A short value after the label, e.g. a duration or a size. */
  extra?: string | number
  /** A second line. Turns the node into a card. */
  description?: string
  /** Tints the description, for a note that needs attention. */
  descriptionTone?: Tone
  /** `card` lays the node out in lines; by default nodes with a description or progress are cards. */
  shape?: FlowNodeShape
  /** From 0 to 100. */
  progress?: number
  /** Some of its sub-tasks are not finished; marked on the right end. */
  incomplete?: boolean
  disabled?: boolean
  /** Anything else rides along to the slots. */
  [key: string]: unknown
}

export interface FlowEdge {
  from: string
  to: string
  /** `active` draws the edge in ink, e.g. for a critical path; `muted` fades it. */
  status?: 'default' | 'active' | 'muted'
}

/** What hovering or selecting a node brings forward: its upstream and downstream chain. */
export type FlowGraphHighlight = 'none' | 'hover' | 'selected'

export interface FlowGraphProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** The selected node, or nodes with `selectable: 'multiple'`; bound with `v-model:selected`. */
  selected?: string | string[] | null
  selectable?: boolean | 'multiple'
  size?: FlowGraphSize
  /** `column` widens nodes to the widest in their column; a number fixes every node's width. */
  nodeWidth?: 'column' | 'auto' | number
  /** The widest a node grows to before its label is cut off, in px. */
  maxNodeWidth?: number
  columnGap?: number
  rowGap?: number
  highlight?: FlowGraphHighlight
  /** Show `blocked` for nodes in progress while a predecessor is not finished. */
  autoBlocked?: boolean
  /** Drag, scroll or swipe to move around when the graph is larger than its box. */
  pannable?: boolean
  /** Ctrl or ⌘ with the wheel, or a pinch, to zoom; adds zoom buttons. */
  zoomable?: boolean
  /** The zoom level, bound with `v-model:zoom`. */
  zoom?: number
  minZoom?: number
  maxZoom?: number
  /** Show a legend button in the toolbar. */
  legend?: boolean
  /** The height of the box; a number is in px. Fits the graph by default. */
  height?: string | number
  /** Names the graph for screen readers. */
  label?: string
}

export interface FlowNodeSlotProps {
  node: FlowNode
  status: FlowNodeStatus
  selected: boolean
  hovered: boolean
}

export interface FlowGraphEmits {
  'update:selected': [value: string | string[] | null]
  'update:zoom': [value: number]
  'update:hovered': [value: string | null]
  'node-click': [node: FlowNode, event: MouseEvent]
  'node-dblclick': [node: FlowNode, event: MouseEvent]
  /** The pointer entered a node; `el` is the node, e.g. to anchor a popover. */
  'node-enter': [node: FlowNode, el: HTMLElement]
  'node-leave': [node: FlowNode, el: HTMLElement]
}

export interface FlowGraphSlots {
  /** Replaces everything inside a node; the frame, position and states stay. */
  node?: (props: FlowNodeSlotProps) => unknown
  /** Replaces the status dot. */
  status?: (props: FlowNodeSlotProps) => unknown
  icon?: (props: FlowNodeSlotProps) => unknown
  label?: (props: FlowNodeSlotProps) => unknown
  extra?: (props: FlowNodeSlotProps) => unknown
  description?: (props: FlowNodeSlotProps) => unknown
  /** A small round badge on the top right corner, e.g. a button. */
  corner?: (props: FlowNodeSlotProps) => unknown
  /** Shown in a popover while hovering a node. */
  detail?: (props: FlowNodeSlotProps) => unknown
  /** Extra buttons in the toolbar on the top right. */
  toolbar?: () => unknown
  /** Replaces the content of the legend popover. */
  legend?: () => unknown
  empty?: () => unknown
}

export interface FlowGraphExpose {
  /** Move the view so the node is in sight. */
  scrollToNode: (id: string) => void
  /** Show the whole graph: zooms out if zoomable, otherwise moves back to the start. */
  fit: () => void
  zoomTo: (zoom: number) => void
  resetView: () => void
  /** Measure the nodes again and lay out, e.g. after a font loads. */
  relayout: () => void
}

export interface FlowGraphLegendItem {
  /** What the swatch shows. */
  type: 'kind' | 'status' | 'incomplete' | 'progress'
  value?: FlowNodeKind | FlowNodeStatus
  label: string
}

export interface FlowGraphLegendProps {
  /** Lists what these nodes use. Leave out to list everything. */
  nodes?: FlowNode[]
  items?: FlowGraphLegendItem[]
  title?: string
}
