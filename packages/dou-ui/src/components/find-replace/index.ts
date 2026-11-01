import { withInstall } from '../../utils/install'
import FindReplace from './find-replace.vue'

export const DouFindReplace = withInstall(FindReplace)
export default DouFindReplace

export type * from './find-replace'
export type FindReplaceInstance = InstanceType<typeof FindReplace>

declare module 'vue' {
  export interface GlobalComponents {
    DouFindReplace: typeof DouFindReplace
  }
}
