import { withInstall } from 'dou-ui'
import Area from './components/area.vue'
import Axis from './components/axis.vue'
import Bar from './components/bar.vue'
import Line from './components/line.vue'
import Pie from './components/pie.vue'
import Heatmap from './components/heatmap.vue'
import Radar from './components/radar.vue'
import Funnel from './components/funnel.vue'
import Waterfall from './components/waterfall.vue'
import Histogram from './components/histogram.vue'
import Boxplot from './components/boxplot.vue'
import Gauge from './components/gauge.vue'
import Treemap from './components/treemap.vue'
import Sunburst from './components/sunburst.vue'
import Scatter from './components/scatter.vue'
import Tooltip from './components/tooltip.vue'
import Zoom from './components/zoom.vue'
import Brush from './components/brush.vue'
import Range from './components/range.vue'
import Marker from './components/marker.vue'
import Chart from './chart.vue'

export const DouChart = withInstall(Chart)
export const DouChartAxis = withInstall<typeof Axis, {}>(Axis)
export const DouChartLine = withInstall<typeof Line, {}>(Line)
export const DouChartArea = withInstall<typeof Area, {}>(Area)
export const DouChartBar = withInstall<typeof Bar, {}>(Bar)
export const DouChartScatter = withInstall<typeof Scatter, {}>(Scatter)
export const DouChartPie = withInstall<typeof Pie, {}>(Pie)
export const DouChartHeatmap = withInstall<typeof Heatmap, {}>(Heatmap)
export const DouChartRadar = withInstall<typeof Radar, {}>(Radar)
export const DouChartFunnel = withInstall<typeof Funnel, {}>(Funnel)
export const DouChartWaterfall = withInstall<typeof Waterfall, {}>(Waterfall)
export const DouChartHistogram = withInstall<typeof Histogram, {}>(Histogram)
export const DouChartBoxplot = withInstall<typeof Boxplot, {}>(Boxplot)
export const DouChartGauge = withInstall<typeof Gauge, {}>(Gauge)
export const DouChartTreemap = withInstall<typeof Treemap, {}>(Treemap)
export const DouChartSunburst = withInstall<typeof Sunburst, {}>(Sunburst)
export const DouChartTooltip = withInstall<typeof Tooltip, {}>(Tooltip)
export const DouChartZoom = withInstall<typeof Zoom, {}>(Zoom)
export const DouChartBrush = withInstall<typeof Brush, {}>(Brush)
export const DouChartRange = withInstall<typeof Range, {}>(Range)
export const DouChartMarker = withInstall<typeof Marker, {}>(Marker)
export default DouChart

export { defineChartSeries } from './define'
export type { ChartSeriesOptions } from './define'
export type {
  ChartAreaProps,
  ChartAxisProps,
  ChartBarProps,
  ChartBoxplotProps,
  ChartItemColor,
  ChartDataLabel,
  ChartLabelFormat,
  ChartBrushEvent,
  ChartBrushProps,
  ChartExportOptions,
  ChartEmits,
  ChartExpose,
  ChartFunnelProps,
  ChartGaugeProps,
  ChartGaugeSlots,
  ChartHeatmapProps,
  ChartHistogramProps,
  ChartImageOptions,
  ChartInterval,
  ChartLineProps,
  ChartMarkerProps,
  ChartPieProps,
  ChartPieSlots,
  ChartPointEvent,
  ChartRadarProps,
  ChartProps,
  ChartScatterProps,
  ChartSunburstProps,
  ChartSunburstSlots,
  ChartSlots,
  ChartTooltipItem,
  ChartTooltipProps,
  ChartTooltipSlots,
  ChartTreeProps,
  ChartTreemapProps,
  ChartWaterfallProps,
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
export type { ChartCategorySort } from './core/model'
export type { ChartPattern } from './core/pattern'
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
    DouChartHeatmap: typeof DouChartHeatmap
    DouChartRadar: typeof DouChartRadar
    DouChartFunnel: typeof DouChartFunnel
    DouChartWaterfall: typeof DouChartWaterfall
    DouChartHistogram: typeof DouChartHistogram
    DouChartBoxplot: typeof DouChartBoxplot
    DouChartGauge: typeof DouChartGauge
    DouChartTreemap: typeof DouChartTreemap
    DouChartSunburst: typeof DouChartSunburst
    DouChartPie: typeof DouChartPie
    DouChartTooltip: typeof DouChartTooltip
    DouChartZoom: typeof DouChartZoom
    DouChartBrush: typeof DouChartBrush
    DouChartRange: typeof DouChartRange
    DouChartMarker: typeof DouChartMarker
  }
}
