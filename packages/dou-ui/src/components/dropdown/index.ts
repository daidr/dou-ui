import { withInstall } from '../../utils/install'
import Dropdown from './dropdown.vue'
import DropdownButton from './dropdown-button.vue'
import DropdownItem from './dropdown-item.vue'
import DropdownSub from './dropdown-sub.vue'

export const DouDropdown = withInstall(Dropdown)
export const DouDropdownItem = withInstall(DropdownItem)
export const DouDropdownSub = withInstall(DropdownSub)
export const DouDropdownButton = withInstall(DropdownButton)
export default DouDropdown

export { dropdownKey } from './dropdown'
export type * from './dropdown'
export type DropdownInstance = InstanceType<typeof Dropdown>
export type DropdownItemInstance = InstanceType<typeof DropdownItem>
export type DropdownSubInstance = InstanceType<typeof DropdownSub>
export type DropdownButtonInstance = InstanceType<typeof DropdownButton>

declare module 'vue' {
  export interface GlobalComponents {
    DouDropdown: typeof DouDropdown
    DouDropdownItem: typeof DouDropdownItem
    DouDropdownSub: typeof DouDropdownSub
    DouDropdownButton: typeof DouDropdownButton
  }
}
