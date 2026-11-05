import type { App } from 'vue'
import { withInstall } from '../../utils/install'
import Dialog from './dialog.vue'
import { setInstalledAppContext } from '../../utils/app-context'

export const DouDialog = withInstall(Dialog)
const installDialog = DouDialog.install
// Installing the dialog also lets `dialog.confirm()` and friends borrow the app's config.
DouDialog.install = (app: App) => {
  installDialog?.(app)
  // oxlint-disable-next-line no-underscore-dangle -- the public way to reach an app's context
  setInstalledAppContext(app._context)
}
export default DouDialog

export { dialog, useDialog } from './functional'
export type { DialogApi } from './functional'
export type * from './dialog'
export type * from './dialog-api'
export type DialogInstance = InstanceType<typeof Dialog>

declare module 'vue' {
  export interface GlobalComponents {
    DouDialog: typeof DouDialog
  }
}
