import { withInstall } from '../../utils/install'
import Banner from './banner.vue'

export const DouBanner = withInstall(Banner)
export default DouBanner

export type * from './banner'
export type BannerInstance = InstanceType<typeof Banner>

declare module 'vue' {
  export interface GlobalComponents {
    DouBanner: typeof DouBanner
  }
}
