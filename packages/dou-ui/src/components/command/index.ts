import { withInstall } from '../../utils/install'
import Command from './command.vue'
import CommandDialog from './command-dialog.vue'

export const DouCommand = withInstall(Command)
export const DouCommandDialog = withInstall(CommandDialog)
export default DouCommand

export type * from './command'
export { fuzzyMatch, matchCommand } from './command'
export type CommandInstance = InstanceType<typeof Command>

declare module 'vue' {
  export interface GlobalComponents {
    DouCommand: typeof DouCommand
    DouCommandDialog: typeof DouCommandDialog
  }
}
