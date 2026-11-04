import { withInstall } from '../../utils/install'
import Dropdown from './dropdown.vue'
import DropdownButton from './dropdown-button.vue'
import type DropdownGroup from './dropdown-group.vue'
import type DropdownItem from './dropdown-item.vue'
import type DropdownRadioGroup from './dropdown-radio-group.vue'
import { DouDropdownGroup, DouDropdownItem, DouDropdownRadioGroup } from './item-components'
import DropdownSub from './dropdown-sub.vue'

export const DouDropdown = withInstall(Dropdown)
export const DouDropdownSub = withInstall(DropdownSub)
export const DouDropdownButton = withInstall(DropdownButton)
export { DouDropdownGroup, DouDropdownItem, DouDropdownRadioGroup }
export default DouDropdown

export { dropdownHostKey, dropdownKey } from './dropdown'
export type * from './dropdown'
export type DropdownInstance = InstanceType<typeof Dropdown>
export type DropdownItemInstance = InstanceType<typeof DropdownItem>
export type DropdownSubInstance = InstanceType<typeof DropdownSub>
export type DropdownGroupInstance = InstanceType<typeof DropdownGroup>
export type DropdownRadioGroupInstance = InstanceType<typeof DropdownRadioGroup>
export type DropdownButtonInstance = InstanceType<typeof DropdownButton>

declare module 'vue' {
  export interface GlobalComponents {
    DouDropdown: typeof DouDropdown
    DouDropdownItem: typeof DouDropdownItem
    DouDropdownSub: typeof DouDropdownSub
    DouDropdownGroup: typeof DouDropdownGroup
    DouDropdownRadioGroup: typeof DouDropdownRadioGroup
    DouDropdownButton: typeof DouDropdownButton
  }
}
