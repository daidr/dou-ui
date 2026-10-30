import { withInstall } from 'dou-ui'
import FlowEditor from './flow-editor.vue'
import FlowControls from './components/flow-controls.vue'
import FlowPortComponent from './components/flow-port.vue'

export const DouFlowEditor = withInstall(FlowEditor)
export const DouFlowControls = withInstall(FlowControls)
export const DouFlowPort = withInstall(FlowPortComponent)
export default DouFlowEditor

export { useFlowEditor } from './context'
export type {
  FlowEditorContext,
  FlowEditorEmits,
  FlowEditorExpose,
  FlowEditorProps,
  NodeMetrics,
  PortAnchor,
  PortState,
} from './context'
export { flowLocales, useFlowMessages } from './locale'
export type { FlowMessages } from './locale'
export { defaultNode } from './components/default-node'
export type { DefaultNodeData } from './components/default-node'
export { defineNodeType, labelOf, portSide, portsOf } from './core/node-types'
export type { NodeTypeSpec, NodeViewProps } from './core/node-types'
export { createId, emptyDocument, emptySelection } from './core/model'
export type {
  FlowData,
  FlowDocument,
  FlowEdge,
  FlowEndpoint,
  FlowNode,
  FlowPortSpec,
  FlowSelection,
  FlowViewport,
  Point,
  PortSide,
  Rect,
} from './core/model'
export { applySteps, compactSteps, Transaction } from './core/transaction'
export type { FlowStep, TransactionMeta } from './core/transaction'
export { FlowHistory } from './core/history'
export { canJoin, primaryType, reaches, typesMatch } from './core/connect'
export type {
  ConnectOptions,
  FlowConnection,
  PortShape,
  PortTone,
  PortTypes,
  PortTypeSpec,
} from './core/connect'
export { bezierPath, boundsOf, intersects, rectFrom, snapBox, snapTo } from './core/geometry'
export type { Guide, SnapResult } from './core/geometry'

declare module 'vue' {
  export interface GlobalComponents {
    DouFlowEditor: typeof DouFlowEditor
    DouFlowControls: typeof DouFlowControls
    DouFlowPort: typeof DouFlowPort
  }
}
