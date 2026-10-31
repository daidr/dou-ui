import { withInstall } from 'dou-ui'
import FlowEditor from './flow-editor.vue'
import FlowControls from './components/flow-controls.vue'
import FlowMinimap from './components/flow-minimap.vue'
import FlowPortComponent from './components/flow-port.vue'

export const DouFlowEditor = withInstall(FlowEditor)
export const DouFlowControls = withInstall(FlowControls)
export const DouFlowMinimap = withInstall(FlowMinimap)
export const DouFlowPort = withInstall(FlowPortComponent)
export default DouFlowEditor

export { useFlowEditor } from './context'
export type {
  FlowControlsProps,
  FlowEditorContext,
  FlowEditorEmits,
  FlowEditorExpose,
  FlowEditorProps,
  FlowInsertOptions,
  FlowMinimapProps,
  FlowEditorSlots,
  FlowPanelPlacement,
  NodeMetrics,
  PortAnchor,
  PortState,
} from './context'
export { flowLocales, useFlowMessages } from './locale'
export type { FlowMessages, FlowMessagesOverride } from './locale'
export { defaultNode } from './components/default-node'
export type { DefaultNodeData } from './components/default-node'
export { defineNodeType, labelOf, portSide, portsOf } from './core/node-types'
export type { NodePaletteSpec, NodeTypeSpec, NodeViewProps } from './core/node-types'
export type { FlowMenuItem, FlowMenuTarget, FlowToolbarItem } from './core/menu'
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
export { applyFlowSteps, compactFlowSteps, FlowTransaction } from './core/transaction'
export type { FlowStep, FlowTransactionMeta } from './core/transaction'
export { FlowHistory } from './core/history'
export { defineFlowExtension } from './core/extension'
export type { FlowExtension, FlowExtensionContext, FlowKeyHandler } from './core/extension'
export { flowKit } from './kit'
export type { FlowKitOptions } from './kit'
export { flowOrder } from './core/order'
export {
  canJoin,
  displacedEdges,
  joinRefusal,
  primaryType,
  reaches,
  typesMatch,
} from './core/connect'
export type {
  ConnectOptions,
  FlowConnection,
  JoinRefusal,
  PortShape,
  PortTypes,
  PortTypeSpec,
} from './core/connect'
export { boundsOf, intersects, rectFrom, snapBox, snapTo } from './core/geometry'
export { bezierEdge, bezierPath, defineEdgeType, stepEdge, straightEdge } from './core/edge-types'
export type { EdgeAnchor, EdgeRoute, EdgeTypeSpec } from './core/edge-types'
export type { Guide, SnapResult } from './core/geometry'

declare module 'vue' {
  export interface GlobalComponents {
    DouFlowEditor: typeof DouFlowEditor
    DouFlowControls: typeof DouFlowControls
    DouFlowMinimap: typeof DouFlowMinimap
    DouFlowPort: typeof DouFlowPort
  }
}
