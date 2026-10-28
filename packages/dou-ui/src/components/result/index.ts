import { withInstall } from '../../utils/install'
import Result from './result.vue'

export const DouResult = withInstall(Result)
export default DouResult

export type * from './result'
export type ResultInstance = InstanceType<typeof Result>

declare module 'vue' {
  export interface GlobalComponents {
    DouResult: typeof DouResult
  }
}
