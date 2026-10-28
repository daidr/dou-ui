import { withInstall } from '../../utils/install'
import Spinner from './spinner.vue'

export const DouSpinner = withInstall(Spinner)
export default DouSpinner

export type * from './spinner'
export type SpinnerInstance = InstanceType<typeof Spinner>

declare module 'vue' {
  export interface GlobalComponents {
    DouSpinner: typeof DouSpinner
  }
}
