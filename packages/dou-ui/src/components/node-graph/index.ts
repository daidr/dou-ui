import { withInstall } from '../../utils/install'
import NodeGraph from './node-graph.vue'
import NodeGraphLegend from './node-graph-legend.vue'

export const DouNodeGraph = withInstall(NodeGraph)
export const DouNodeGraphLegend = withInstall(NodeGraphLegend)
export default DouNodeGraph

export { layoutGraph } from './layout'
export type {
  GraphLayout,
  LayoutEdge,
  LayoutNode,
  LayoutOptions,
  PlacedEdge,
  PlacedNode,
} from './layout'
export type * from './node-graph'
export type NodeGraphInstance = InstanceType<typeof NodeGraph>

declare module 'vue' {
  export interface GlobalComponents {
    DouNodeGraph: typeof DouNodeGraph
    DouNodeGraphLegend: typeof DouNodeGraphLegend
  }
}
