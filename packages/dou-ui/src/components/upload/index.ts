import { withInstall } from '../../utils/install'
import Upload from './upload.vue'

export const DouUpload = withInstall(Upload)
export default DouUpload

export type * from './upload'
export { formatFileSize, matchesAccept } from './upload'
export type UploadInstance = InstanceType<typeof Upload>

declare module 'vue' {
  export interface GlobalComponents {
    DouUpload: typeof DouUpload
  }
}
