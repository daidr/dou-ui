import { withInstall } from '../../utils/install'
import Space from './space.vue'

export const DouSpace = withInstall(Space)
export default DouSpace

export type * from './space'
export type SpaceInstance = InstanceType<typeof Space>

declare module 'vue' {
  export interface GlobalComponents {
    DouSpace: typeof DouSpace
  }
}
