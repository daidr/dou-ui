import { withInstall } from 'dou-ui'
import FlowEditor from './flow-editor.vue'
import FlowControls from './components/flow-controls.vue'
import FlowMinimap from './components/flow-minimap.vue'
import { DouFlowPort } from './components/port'

export const DouFlowEditor = withInstall(FlowEditor)
export const DouFlowControls = withInstall(FlowControls)
export const DouFlowMinimap = withInstall(FlowMinimap)
export { DouFlowPort }
export default DouFlowEditor

export { useFlowEditor } from './context'
export type {
  FlowCommentAnchor,
  FlowControlsProps,
  FlowEditorContext,
  FlowEditorEmits,
  FlowEditorExpose,
  FlowEditorProps,
  FlowInsertOptions,
  FlowMinimapProps,
  FlowNodePreview,
  FlowEditorSlots,
  FlowPanelPlacement,
  FlowSearchQuery,
  NodeMetrics,
  PortAnchor,
  PortState,
} from './context'
export { flowLocales, useFlowMessages } from './locale'
export type { FlowMessages, FlowMessagesOverride } from './locale'
export { defaultNode } from './components/default-node'
export type { DefaultNodeData } from './components/default-node'
export { groupNode } from './components/group-node'
export type { GroupNodeData } from './components/group-node'
export { containerAt, FlowTree } from './core/groups'
export { defineNodeType, labelOf, portSide, portsOf, resizeOf } from './core/node-types'
export type { NodePaletteSpec, NodeResize, NodeTypeSpec, NodeViewProps } from './core/node-types'
export type { FlowMenuTarget, FlowToolbarItem } from './core/menu'
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
export { checkDocument, migrateDocument } from './document'
export type { CheckDocumentOptions, DocumentProblem } from './document'
export { applyFlowSteps, compactFlowSteps, FlowTransaction } from './core/transaction'
export type { FlowStep, FlowTransactionMeta } from './core/transaction'
export { FlowHistory } from './core/history'
export { defineFlowExtension } from './core/extension'
export type {
  FlowExtension,
  FlowExtensionContext,
  FlowHistoryHandler,
  FlowKeyHandler,
  FlowPress,
  FlowPressHandler,
} from './core/extension'
export { flowKit } from './kit'
export type { FlowKitOptions } from './kit'
export { moveLayer } from './layers'
export { drawCard } from './export/draw'
export type { FlowExportOptions, FlowImageOptions } from './export/draw'
export type { FlowDrawContext, FlowDrawTextOptions } from './export/context'
export type { LayerMove } from './layers'
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
