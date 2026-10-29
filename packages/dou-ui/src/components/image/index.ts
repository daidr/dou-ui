import { withInstall } from '../../utils/install'
import Image from './image.vue'
import ImagePreview from './image-preview.vue'

export const DouImage = withInstall(Image)
export const DouImagePreview = withInstall(ImagePreview)
export default DouImage

export type * from './image'
export type ImageInstance = InstanceType<typeof Image>
export type ImagePreviewInstance = InstanceType<typeof ImagePreview>

declare module 'vue' {
  export interface GlobalComponents {
    DouImage: typeof DouImage
    DouImagePreview: typeof DouImagePreview
  }
}
