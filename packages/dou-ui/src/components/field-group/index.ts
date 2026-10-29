import { withInstall } from '../../utils/install'
import FieldGroup from './field-group.vue'
import FieldGroupText from './field-group-text.vue'

export const DouFieldGroup = withInstall(FieldGroup)
export const DouFieldGroupText = withInstall(FieldGroupText)
export default DouFieldGroup

export { fieldGroupKey } from './field-group'
export type * from './field-group'

declare module 'vue' {
  export interface GlobalComponents {
    DouFieldGroup: typeof DouFieldGroup
    DouFieldGroupText: typeof DouFieldGroupText
  }
}
