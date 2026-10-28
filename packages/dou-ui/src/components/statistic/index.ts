import { withInstall } from '../../utils/install'
import Statistic from './statistic.vue'

export const DouStatistic = withInstall(Statistic)
export default DouStatistic

export type * from './statistic'
export type StatisticInstance = InstanceType<typeof Statistic>

declare module 'vue' {
  export interface GlobalComponents {
    DouStatistic: typeof DouStatistic
  }
}
