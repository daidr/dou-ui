import { withInstall } from '../../utils/install'
import FlowGraph from './flow-graph.vue'
import FlowGraphLegend from './flow-graph-legend.vue'

export const DouFlowGraph = withInstall(FlowGraph)
export const DouFlowGraphLegend = withInstall(FlowGraphLegend)
export default DouFlowGraph

export { layoutFlow } from './layout'
export type {
  FlowLayout,
  LayoutEdge,
  LayoutNode,
  LayoutOptions,
  PlacedEdge,
  PlacedNode,
} from './layout'
export type * from './flow-graph'
export type FlowGraphInstance = InstanceType<typeof FlowGraph>

declare module 'vue' {
  export interface GlobalComponents {
    DouFlowGraph: typeof DouFlowGraph
    DouFlowGraphLegend: typeof DouFlowGraphLegend
  }
}
