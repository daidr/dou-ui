import { withInstall } from '../../utils/install'
import Watermark from './watermark.vue'

export const DouWatermark = withInstall(Watermark)
export default DouWatermark

export type * from './watermark'
export type WatermarkInstance = InstanceType<typeof Watermark>

declare module 'vue' {
  export interface GlobalComponents {
    DouWatermark: typeof DouWatermark
  }
}
