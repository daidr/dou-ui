import { withInstall } from '../../utils/install'
import Checkbox from './checkbox.vue'
import CheckboxGroup from './checkbox-group.vue'

export const DouCheckbox = withInstall(Checkbox)
export const DouCheckboxGroup = withInstall(CheckboxGroup)
export default DouCheckbox

export { checkboxGroupKey } from './checkbox'
export type * from './checkbox'
export type CheckboxGroupInstance = InstanceType<typeof CheckboxGroup>

declare module 'vue' {
  export interface GlobalComponents {
    DouCheckbox: typeof DouCheckbox
    DouCheckboxGroup: typeof DouCheckboxGroup
  }
}
