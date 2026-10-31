import { withInstall } from 'dou-ui'
import Area from './components/area.vue'
import Axis from './components/axis.vue'
import Bar from './components/bar.vue'
import Line from './components/line.vue'
import Pie from './components/pie.vue'
import Scatter from './components/scatter.vue'
import Chart from './chart.vue'

export const DouChart = withInstall(Chart)
export const DouChartAxis = withInstall(Axis)
export const DouChartLine = withInstall(Line)
export const DouChartArea = withInstall(Area)
export const DouChartBar = withInstall(Bar)
export const DouChartScatter = withInstall(Scatter)
export const DouChartPie = withInstall(Pie)
export default DouChart

export { defineChartSeries } from './define'
export type { ChartSeriesOptions } from './define'
export type {
  ChartAreaProps,
  ChartAxisProps,
  ChartBarProps,
  ChartLineProps,
  ChartPieProps,
  ChartPieSlots,
  ChartProps,
  ChartScatterProps,
  ChartSlots,
} from './types'
export type { ChartAccessor, ChartRow, XColumn as ChartColumn } from './core/data'
export type { ChartAxisRole, ChartAxisType, ChartTickValue } from './core/layout'
export type { Painter as ChartPainter, Rect as ChartRect } from './core/painter'
export type { Scale as ChartScale } from './core/scale'
export type {
  ChartColors,
  ChartSeries,
  ChartSeriesKind,
  ChartSeriesProps,
  ChartValueAxis,
  ChartView,
} from './core/series'
export { chartLocales, useChartMessages } from './locale'
export type { ChartMessages, ChartMessagesOverride } from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouChart: typeof DouChart
    DouChartAxis: typeof DouChartAxis
    DouChartLine: typeof DouChartLine
    DouChartArea: typeof DouChartArea
    DouChartBar: typeof DouChartBar
    DouChartScatter: typeof DouChartScatter
    DouChartPie: typeof DouChartPie
  }
}
