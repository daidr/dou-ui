import { withInstall } from '../../utils/install'
import DropdownGroup from './dropdown-group.vue'
import DropdownItem from './dropdown-item.vue'
import DropdownRadioGroup from './dropdown-radio-group.vue'

// 单独成模块：选项列表（dropdown-items.vue）从这里取包装过的组件，不经过 index 就不会绕成循环引用
export const DouDropdownItem = withInstall(DropdownItem)
export const DouDropdownGroup = withInstall(DropdownGroup)
export const DouDropdownRadioGroup = withInstall(DropdownRadioGroup)
