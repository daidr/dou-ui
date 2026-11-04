import { withInstall } from 'dou-ui'
import FlowPort from './flow-port.vue'

// 单独成模块：白板（@dou-ui/flow/whiteboard）从这里取包装过的组件，不用引入整个编辑器入口
export const DouFlowPort = withInstall(FlowPort)
