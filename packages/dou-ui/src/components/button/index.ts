import { withInstall } from '../../utils/install'
import type { ButtonAttributes } from '../../utils/install'
import Button from './button.vue'

export const DouButton = withInstall<typeof Button, ButtonAttributes>(Button)
export default DouButton

export type * from './button'
export type ButtonInstance = InstanceType<typeof Button>

declare module 'vue' {
  export interface GlobalComponents {
    DouButton: typeof DouButton
  }
}
