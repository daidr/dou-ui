import { withInstall } from '../../utils/install'
import ColorPicker from './color-picker.vue'

export const DouColorPicker = withInstall(ColorPicker)
export default DouColorPicker

export type * from './color-picker'
export type ColorPickerInstance = InstanceType<typeof ColorPicker>

declare module 'vue' {
  export interface GlobalComponents {
    DouColorPicker: typeof DouColorPicker
  }
}
