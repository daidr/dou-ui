import { withInstall } from '../../utils/install'
import FindReplace from './find-replace.vue'
import type { FindReplaceExpose } from './find-replace'

export const DouFindReplace = withInstall(FindReplace)
export default DouFindReplace

export type * from './find-replace'
export type FindReplaceInstance = FindReplaceExpose

declare module 'vue' {
  export interface GlobalComponents {
    DouFindReplace: typeof DouFindReplace
  }
}
