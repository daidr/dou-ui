import type { Component } from 'vue'
import type { FlowMessages } from '../locale'
import type { FlowData, FlowNode, FlowPortSpec, PortSide } from './model'

/** What a node type's component receives. */
export interface NodeViewProps<Data extends FlowData = FlowData> {
  node: FlowNode<Data>
  data: Data
  ports: FlowPortSpec[]
  selected: boolean
  readonly: boolean
  /** Merges `patch` into the node's data, as one undo step. */
  updateData: (patch: Partial<Data>) => void
}

export interface NodeTypeSpec<Data extends FlowData = FlowData> {
  type: string
  /**
   * Renders the node's content. The editor draws the frame, selection and
   * focus ring around it. Place ports with `<DouFlowPort>`; ports the
   * component does not place are spread along their sides.
   */
  component?: Component
  /** The node's ports, fixed or worked out from its data. */
  ports?: FlowPortSpec[] | ((node: FlowNode<Data>) => FlowPortSpec[])
  /** Data for a new node of this type. */
  defaults?: () => Data
  /**
   * The node's accessible name; `data.label` by default. `messages` are the
   * editor's current strings, for names that follow the locale.
   */
  label?: (node: FlowNode<Data>, messages: FlowMessages) => string
  /**
   * How the type is offered by `paletteTypes` and in the list that opens
   * when an edge is dropped on the empty canvas. Types without it aren't offered.
   */
  palette?: NodePaletteSpec
  /**
   * Nodes dropped inside become its children (`parent`) and move with it;
   * with `data.collapsed` they are hidden and their edges end on it.
   * Containers are drawn under edges and other nodes.
   */
  container?: boolean
  /**
   * A handle on the selected node changes its stored `width` and `height`.
   * A function decides per node, e.g. not while it is turned.
   */
  resizable?: NodeResize | ((node: FlowNode<Data>) => NodeResize)
  /** The `width` and `height` a new node starts with. */
  size?: { width: number; height: number }
  /**
   * `false` leaves out the card the editor draws around the component (its
   * border, background and shadow), for nodes that draw their own outline,
   * e.g. a circle. Selection then shows as a thin outline around the box.
   */
  frame?: boolean
}

export interface NodePaletteSpec {
  label: string
  icon?: Component
  /** Types with the same group are listed together under its name. */
  group?: string
  description?: string
  /** Other words the search should find the type by. */
  keywords?: string[]
}

/** Declares a node type, with the data type checked against its component. */
export function defineNodeType<Data extends FlowData = FlowData>(
  spec: NodeTypeSpec<Data>,
): NodeTypeSpec<Data> {
  return spec
}

export const portSide = (port: FlowPortSpec): PortSide =>
  port.side ?? (port.kind === 'input' ? 'left' : 'right')

export function portsOf(spec: NodeTypeSpec | undefined, node: FlowNode): FlowPortSpec[] {
  const ports = spec?.ports
  if (!ports) return []
  return typeof ports === 'function' ? ports(node) : ports
}

export type NodeResize = boolean | { minWidth?: number; minHeight?: number }

/** Whether a node can be resized, and its smallest size; `null` when it can't. */
export function resizeOf(
  spec: NodeTypeSpec | undefined,
  node: FlowNode,
): { minWidth?: number; minHeight?: number } | null {
  const value = typeof spec?.resizable === 'function' ? spec.resizable(node) : spec?.resizable
  if (!value) return null
  return value === true ? {} : value
}

export function labelOf(
  spec: NodeTypeSpec | undefined,
  node: FlowNode,
  messages: FlowMessages,
): string {
  if (spec?.label) return spec.label(node, messages)
  const label = node.data?.label
  return typeof label === 'string' ? label : node.id
}
