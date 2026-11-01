import type { ButtonHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import CopyButton from './copy-button.vue'

export const DouCopyButton = withInstall<typeof CopyButton, ButtonHTMLAttributes>(CopyButton)
export default DouCopyButton

export type * from './copy-button'
export type CopyButtonInstance = InstanceType<typeof CopyButton>

declare module 'vue' {
  export interface GlobalComponents {
    DouCopyButton: typeof DouCopyButton
  }
}
