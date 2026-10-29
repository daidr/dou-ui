import { withInstall } from '../../utils/install'
import ImageCropper from './image-cropper.vue'

export const DouImageCropper = withInstall(ImageCropper)
export default DouImageCropper

export type * from './image-cropper'
export type ImageCropperInstance = InstanceType<typeof ImageCropper>

declare module 'vue' {
  export interface GlobalComponents {
    DouImageCropper: typeof DouImageCropper
  }
}
