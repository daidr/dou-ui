import type { Component } from 'vue'
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
  /** The node's accessible name; `data.label` by default. */
  label?: (node: FlowNode<Data>) => string
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

export function labelOf(spec: NodeTypeSpec | undefined, node: FlowNode): string {
  if (spec?.label) return spec.label(node)
  const label = node.data?.label
  return typeof label === 'string' ? label : node.id
}
