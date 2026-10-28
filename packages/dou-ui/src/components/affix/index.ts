import { withInstall } from '../../utils/install'
import Affix from './affix.vue'

export const DouAffix = withInstall(Affix)
export default DouAffix

export type * from './affix'
export type AffixInstance = InstanceType<typeof Affix>

declare module 'vue' {
  export interface GlobalComponents {
    DouAffix: typeof DouAffix
  }
}
