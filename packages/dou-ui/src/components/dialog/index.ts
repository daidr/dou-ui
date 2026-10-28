import { withInstall } from '../../utils/install'
import Dialog from './dialog.vue'

export const DouDialog = withInstall(Dialog)
export default DouDialog

export type * from './dialog'
export type DialogInstance = InstanceType<typeof Dialog>

declare module 'vue' {
  export interface GlobalComponents {
    DouDialog: typeof DouDialog
  }
}
