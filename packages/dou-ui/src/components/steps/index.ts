import { withInstall } from '../../utils/install'
import Steps from './steps.vue'

export const DouSteps = withInstall(Steps)
export default DouSteps

export type * from './steps'
export type StepsInstance = InstanceType<typeof Steps>

declare module 'vue' {
  export interface GlobalComponents {
    DouSteps: typeof DouSteps
  }
}
