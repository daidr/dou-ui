import { withInstall } from '../../utils/install'
import Carousel from './carousel.vue'
import CarouselItem from './carousel-item.vue'

export const DouCarousel = withInstall(Carousel)
export const DouCarouselItem = withInstall(CarouselItem)
export default DouCarousel

export type * from './carousel'
export type CarouselInstance = InstanceType<typeof Carousel>
export type CarouselItemInstance = InstanceType<typeof CarouselItem>

declare module 'vue' {
  export interface GlobalComponents {
    DouCarousel: typeof DouCarousel
    DouCarouselItem: typeof DouCarouselItem
  }
}
