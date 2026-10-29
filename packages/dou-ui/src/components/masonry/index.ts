import { withInstall } from '../../utils/install'
import Masonry from './masonry.vue'

export const DouMasonry = withInstall(Masonry)
export default DouMasonry

export type * from './masonry'
export { placeItems } from './masonry'

declare module 'vue' {
  export interface GlobalComponents {
    DouMasonry: typeof DouMasonry
  }
}
