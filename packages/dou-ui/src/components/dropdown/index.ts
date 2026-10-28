import { withInstall } from '../../utils/install'
import Dropdown from './dropdown.vue'
import DropdownItem from './dropdown-item.vue'

export const DouDropdown = withInstall(Dropdown)
export const DouDropdownItem = withInstall(DropdownItem)
export default DouDropdown

export { dropdownKey } from './dropdown'
export type * from './dropdown'
export type DropdownInstance = InstanceType<typeof Dropdown>
export type DropdownItemInstance = InstanceType<typeof DropdownItem>

declare module 'vue' {
  export interface GlobalComponents {
    DouDropdown: typeof DouDropdown
    DouDropdownItem: typeof DouDropdownItem
  }
}
