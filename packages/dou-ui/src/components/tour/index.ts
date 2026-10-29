import { withInstall } from '../../utils/install'
import Tour from './tour.vue'

export const DouTour = withInstall(Tour)
export default DouTour

export type * from './tour'
export type TourInstance = InstanceType<typeof Tour>

declare module 'vue' {
  export interface GlobalComponents {
    DouTour: typeof DouTour
  }
}
