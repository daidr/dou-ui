import type { App } from 'vue'
import { withInstall } from '../../utils/install'
import { vInfiniteScroll } from './directive'
import InfiniteScroll from './infinite-scroll.vue'

export const DouInfiniteScroll = withInstall(InfiniteScroll)
const installInfiniteScroll = DouInfiniteScroll.install
// Installing the component also registers `v-infinite-scroll`.
DouInfiniteScroll.install = (app: App) => {
  installInfiniteScroll?.(app)
  app.directive('infinite-scroll', vInfiniteScroll)
}
export default DouInfiniteScroll

export { vInfiniteScroll }
export type * from './infinite-scroll'
export type InfiniteScrollInstance = InstanceType<typeof InfiniteScroll>

declare module 'vue' {
  export interface GlobalComponents {
    DouInfiniteScroll: typeof DouInfiniteScroll
  }
  export interface GlobalDirectives {
    vInfiniteScroll: typeof vInfiniteScroll
  }
}
