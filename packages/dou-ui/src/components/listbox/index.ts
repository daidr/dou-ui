import { withInstall } from '../../utils/install'
import Listbox from './listbox.vue'

export const DouListbox = withInstall(Listbox)
export default DouListbox

export type * from './listbox'
export type ListboxInstance = InstanceType<typeof Listbox>

declare module 'vue' {
  export interface GlobalComponents {
    DouListbox: typeof DouListbox
  }
}
