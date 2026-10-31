import { withInstall } from 'dou-ui'
import Area from './components/area.vue'
import Axis from './components/axis.vue'
import Line from './components/line.vue'
import Chart from './chart.vue'

export const DouChart = withInstall(Chart)
export const DouChartAxis = withInstall(Axis)
export const DouChartLine = withInstall(Line)
export const DouChartArea = withInstall(Area)
export default DouChart

export type {
  ChartAreaProps,
  ChartAxisProps,
  ChartLineProps,
  ChartProps,
  ChartSlots,
} from './types'
export type { ChartAccessor, ChartRow } from './core/data'
export type { ChartAxisPosition, ChartAxisType, ChartTickValue } from './core/layout'
export type { ChartSeriesProps, ChartValueAxis } from './core/series'
export { chartLocales, useChartMessages } from './locale'
export type { ChartMessages, ChartMessagesOverride } from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouChart: typeof DouChart
    DouChartAxis: typeof DouChartAxis
    DouChartLine: typeof DouChartLine
    DouChartArea: typeof DouChartArea
  }
}
