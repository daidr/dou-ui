import { withInstall } from '../../utils/install'
import type { ButtonAttributes } from '../../utils/install'
import ColorModeButton from './color-mode-button.vue'
import ColorModeSelect from './color-mode-select.vue'
import ColorModeSwitch from './color-mode-switch.vue'

export const DouColorModeButton = withInstall<typeof ColorModeButton, ButtonAttributes>(
  ColorModeButton,
)
export const DouColorModeSwitch = withInstall<typeof ColorModeSwitch, ButtonAttributes>(
  ColorModeSwitch,
)
export const DouColorModeSelect = withInstall(ColorModeSelect)
export default DouColorModeButton

export { colorModeScript, useColorMode } from './use-color-mode'
export type { UseColorModeReturn } from './use-color-mode'
export type * from './color-mode'

declare module 'vue' {
  export interface GlobalComponents {
    DouColorModeButton: typeof DouColorModeButton
    DouColorModeSwitch: typeof DouColorModeSwitch
    DouColorModeSelect: typeof DouColorModeSelect
  }
}
