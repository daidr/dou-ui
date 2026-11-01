import { withInstall } from 'dou-ui'
import Area from './components/area.vue'
import Axis from './components/axis.vue'
import Bar from './components/bar.vue'
import Line from './components/line.vue'
import Pie from './components/pie.vue'
import Scatter from './components/scatter.vue'
import Tooltip from './components/tooltip.vue'
import Zoom from './components/zoom.vue'
import Brush from './components/brush.vue'
import Range from './components/range.vue'
import Marker from './components/marker.vue'
import Chart from './chart.vue'

export const DouChart = withInstall(Chart)
export const DouChartAxis = withInstall(Axis)
export const DouChartLine = withInstall(Line)
export const DouChartArea = withInstall(Area)
export const DouChartBar = withInstall(Bar)
export const DouChartScatter = withInstall(Scatter)
export const DouChartPie = withInstall(Pie)
export const DouChartTooltip = withInstall(Tooltip)
export const DouChartZoom = withInstall(Zoom)
export const DouChartBrush = withInstall(Brush)
export const DouChartRange = withInstall(Range)
export const DouChartMarker = withInstall(Marker)
export default DouChart

export { defineChartSeries } from './define'
export type { ChartSeriesOptions } from './define'
export type {
  ChartAreaProps,
  ChartAxisProps,
  ChartBarProps,
  ChartItemColor,
  ChartDataLabel,
  ChartLabelFormat,
  ChartBrushEvent,
  ChartBrushProps,
  ChartExportOptions,
  ChartExpose,
  ChartImageOptions,
  ChartInterval,
  ChartLineProps,
  ChartMarkerProps,
  ChartPieProps,
  ChartPieSlots,
  ChartProps,
  ChartScatterProps,
  ChartSelectEvent,
  ChartSlots,
  ChartTooltipItem,
  ChartTooltipProps,
  ChartTooltipSlots,
  ChartZoomAxis,
  ChartZoomProps,
} from './types'
export type {
  ChartAccessor,
  ChartColumns,
  ChartData,
  ChartRow,
  XColumn as ChartXColumn,
} from './core/data'
export type {
  ChartAxisRole,
  ChartAxisType,
  ChartLegendPlacement,
  ChartTickValue,
} from './core/layout'
export type { Painter as ChartPainter, Rect as ChartRect } from './core/painter'
export type { Scale as ChartScale } from './core/scale'
export type {
  ChartColors,
  ChartHit,
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
    DouChartTooltip: typeof DouChartTooltip
    DouChartZoom: typeof DouChartZoom
    DouChartBrush: typeof DouChartBrush
    DouChartRange: typeof DouChartRange
    DouChartMarker: typeof DouChartMarker
  }
}
