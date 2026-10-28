import type { App } from 'vue'
import { withInstall } from '../../utils/install'
import Dialog from './dialog.vue'
import { setDialogContext } from './functional'

export const DouDialog = withInstall(Dialog)
const installDialog = DouDialog.install
// Installing the dialog also lets `dialog.confirm()` and friends borrow the app's config.
DouDialog.install = (app: App) => {
  installDialog?.(app)
  // oxlint-disable-next-line no-underscore-dangle -- the public way to reach an app's context
  setDialogContext(app._context)
}
export default DouDialog

export { dialog, setDialogContext, useDialog } from './functional'
export type { DialogApi } from './functional'
export type * from './dialog'
export type * from './dialog-api'
export type DialogInstance = InstanceType<typeof Dialog>

declare module 'vue' {
  export interface GlobalComponents {
    DouDialog: typeof DouDialog
  }
}
