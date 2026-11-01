import { withInstall } from '../../utils/install'
import type { ButtonAttributes } from '../../utils/install'
import Toggle from './toggle.vue'
import ToggleGroup from './toggle-group.vue'

export const DouToggle = withInstall<typeof Toggle, ButtonAttributes>(Toggle)
export const DouToggleGroup = withInstall(ToggleGroup)
export default DouToggle

export type * from './toggle'
export type ToggleInstance = InstanceType<typeof Toggle>
export type ToggleGroupInstance = InstanceType<typeof ToggleGroup>

declare module 'vue' {
  export interface GlobalComponents {
    DouToggle: typeof DouToggle
    DouToggleGroup: typeof DouToggleGroup
  }
}
