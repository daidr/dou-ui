import { withInstall } from '../../utils/install'
import Empty from './empty.vue'

export const DouEmpty = withInstall(Empty)
export default DouEmpty

export type * from './empty'
export type EmptyInstance = InstanceType<typeof Empty>

declare module 'vue' {
  export interface GlobalComponents {
    DouEmpty: typeof DouEmpty
  }
}
