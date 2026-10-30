import { withInstall } from '../../utils/install'
import Editable from './editable.vue'

export const DouEditable = withInstall(Editable)
export default DouEditable

export type * from './editable'
export type EditableInstance = InstanceType<typeof Editable>

declare module 'vue' {
  export interface GlobalComponents {
    DouEditable: typeof DouEditable
  }
}
