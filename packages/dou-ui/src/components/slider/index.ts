import { withInstall } from '../../utils/install'
import Slider from './slider.vue'

export const DouSlider = withInstall(Slider)
export default DouSlider

export type * from './slider'
export type SliderInstance = InstanceType<typeof Slider>

declare module 'vue' {
  export interface GlobalComponents {
    DouSlider: typeof DouSlider
  }
}
