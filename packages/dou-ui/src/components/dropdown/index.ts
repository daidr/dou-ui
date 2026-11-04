import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import Dropdown from './dropdown.vue'
import DropdownButton from './dropdown-button.vue'
import type DropdownItem from './dropdown-item.vue'
import type DropdownRadioGroup from './dropdown-radio-group.vue'
import { DouDropdownItem, DouDropdownRadioGroup } from './item-components'
import DropdownSub from './dropdown-sub.vue'

export const DouDropdown = withInstall(Dropdown)
// 默认插槽就是触发元素：套在另一个浮层外面时，属性转交给插槽
forwardsTrigger(Dropdown)
export const DouDropdownSub = withInstall(DropdownSub)
export const DouDropdownButton = withInstall(DropdownButton)
export { DouDropdownItem, DouDropdownRadioGroup }
export default DouDropdown

export { dropdownHostKey, dropdownKey } from './dropdown'
export type * from './dropdown'
export type DropdownInstance = InstanceType<typeof Dropdown>
export type DropdownItemInstance = InstanceType<typeof DropdownItem>
export type DropdownSubInstance = InstanceType<typeof DropdownSub>
export type DropdownRadioGroupInstance = InstanceType<typeof DropdownRadioGroup>
export type DropdownButtonInstance = InstanceType<typeof DropdownButton>

declare module 'vue' {
  export interface GlobalComponents {
    DouDropdown: typeof DouDropdown
    DouDropdownItem: typeof DouDropdownItem
    DouDropdownSub: typeof DouDropdownSub
    DouDropdownRadioGroup: typeof DouDropdownRadioGroup
    DouDropdownButton: typeof DouDropdownButton
  }
}
