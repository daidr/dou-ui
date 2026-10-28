import { withInstall } from '../../utils/install'
import Transfer from './transfer.vue'

export const DouTransfer = withInstall(Transfer)
export default DouTransfer

export type * from './transfer'
export type TransferInstance = InstanceType<typeof Transfer>

declare module 'vue' {
  export interface GlobalComponents {
    DouTransfer: typeof DouTransfer
  }
}
