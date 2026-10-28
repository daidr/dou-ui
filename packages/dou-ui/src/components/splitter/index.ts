import { withInstall } from '../../utils/install'
import Splitter from './splitter.vue'

export const DouSplitter = withInstall(Splitter)
export default DouSplitter

export type * from './splitter'
export type SplitterInstance = InstanceType<typeof Splitter>

declare module 'vue' {
  export interface GlobalComponents {
    DouSplitter: typeof DouSplitter
  }
}
