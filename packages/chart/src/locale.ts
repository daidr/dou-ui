import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface ChartMessages {
  /** The chart's accessible name when it has no `description`. */
  chart: string
  /** Read out for each series: `{name}`, `{count}` points, from `{min}` to `{max}`. */
  series: string
  /** Read out for a series without points: `{name}`. */
  seriesEmpty: string
  /**
   * Read out for a heatmap: `{name}`, `{rows}` rows and `{columns}` columns, the
   * smallest `{min}` and largest `{max}` value and where it is, `{at}`.
   */
  heatmap: string
  /** Read out for a slice of a pie: `{label}`, `{value}`, `{share}` (a percentage). */
  slice: string
  /** Read out for a pie with a `name`: `{name}`, `{slices}`. */
  pie: string
  /** Joins the series in the summary. */
  listSeparator: string
  /** Joins what is read out for one x or point. */
  itemSeparator: string
  /** A slice's value in its tooltip: `{value}`, `{share}` (a percentage). */
  share: string
  /** A band's two ends in its tooltip: `{from}`, `{to}`. */
  band: string
  /** A waterfall's change and the running total after it: `{change}`, `{total}`. */
  waterfallStep: string
  /** A box plot's numbers, in its tooltip: its top and bottom whisker, quartiles and median. */
  boxHigh: string
  boxQ3: string
  boxMedian: string
  boxQ1: string
  boxLow: string
  /** The values past a box plot's whiskers: `{count}`. */
  boxOutliers: string
  /** A box plot's numbers in one line, read out and in the table: `{median}`, `{q1}`, `{q3}`, `{low}`, `{high}`. */
  box: string
  /** Read out with each legend entry: how to show it alone. */
  legendHint: string
  /** Under a pie with slices turned off: `{count}`. */
  hiddenSlices: string
  /** The summary of a chart that can be explored with the keys: `{summary}`. */
  keys: string
  /** The same, for a chart that can also be zoomed: `{summary}`. */
  zoomKeys: string
  /** Read out after zooming with the keys: `{from}`, `{to}`. */
  zoomed: string
  /** Read out after going back to the whole chart. */
  zoomReset: string
  /** The range strip's handles. */
  rangeStart: string
  rangeEnd: string
  /** The chart with the range of its x axis: `{chart}`, `{from}`, `{to}`. */
  range: string
  /** The same, for a `horizontal` chart, whose x axis runs down the side. */
  rangeDown: string
  /** The summary: `{chart}` (with its range) and `{series}` (the series joined). */
  summary: string
  /** Shown, and read out, when no series has a value. */
  empty: string
  /** The table view's caption when the chart has no `aria-label` nor named series. */
  table: string
  /** The table view's caption from its series' names: `{names}`. */
  tableOf: string
  /** Joins the series' names in the table's caption. */
  nameSeparator: string
  /** The table view's head over the series' names, for a scatter's points. */
  tableSeries: string
  /** The table view's head over the values, for a scatter's points and a pie. */
  tableValue: string
  /** The table view's head over a pie's shares. */
  tableShare: string
  /** A funnel stage's share of the stage before it, in its tooltip, table and summary. */
  stageRate: string
  /** A funnel stage's share of the first stage. */
  totalRate: string
  /** Under a table cut short: `{shown}` rows of `{count}`. */
  tableMore: string
}

const zhCN: ChartMessages = {
  chart: '图表',
  series: '{name}：{count} 个数据点，最小 {min}，最大 {max}',
  seriesEmpty: '{name}：没有数据',
  heatmap: '{name}：{rows} 行 {columns} 列，最小 {min}，最大 {max}（{at}）',
  slice: '{label} {value}（{share}）',
  pie: '{name}：{slices}',
  listSeparator: '；',
  itemSeparator: '，',
  share: '{value}（{share}）',
  band: '{from} ~ {to}',
  waterfallStep: '{change}，累计 {total}',
  boxHigh: '上限',
  boxQ3: '上四分位',
  boxMedian: '中位数',
  boxQ1: '下四分位',
  boxLow: '下限',
  boxOutliers: '异常值 {count} 个',
  box: '中位数 {median}，四分位 {q1} ~ {q3}，范围 {low} ~ {high}',
  legendHint: '按 Alt+Enter 或按住 Alt 点击只显示这一项，再按一次恢复全部',
  hiddenSlices: '已隐藏 {count} 项，占比只按显示的部分计算',
  keys: '{summary}。用方向键逐个查看数据',
  zoomKeys: '{summary}。用方向键逐个查看数据，加号和减号缩放，0 复位',
  zoomed: '显示 {from} 至 {to}',
  zoomReset: '显示全部',
  rangeStart: '区间起点',
  rangeEnd: '区间终点',
  range: '{chart}，横轴从 {from} 到 {to}',
  rangeDown: '{chart}，纵轴从 {from} 到 {to}',
  summary: '{chart}。{series}',
  empty: '没有数据',
  table: '图表数据',
  tableOf: '{names}的数据',
  nameSeparator: '、',
  tableSeries: '系列',
  tableValue: '值',
  tableShare: '占比',
  stageRate: '转化率',
  totalRate: '总转化率',
  tableMore: '只显示前 {shown} 行，共 {count} 行',
}

const zhTW: ChartMessages = {
  chart: '圖表',
  series: '{name}：{count} 個資料點，最小 {min}，最大 {max}',
  seriesEmpty: '{name}：沒有資料',
  heatmap: '{name}：{rows} 行 {columns} 列，最小 {min}，最大 {max}（{at}）',
  slice: '{label} {value}（{share}）',
  pie: '{name}：{slices}',
  listSeparator: '；',
  itemSeparator: '，',
  share: '{value}（{share}）',
  band: '{from} ~ {to}',
  waterfallStep: '{change}，累計 {total}',
  boxHigh: '上限',
  boxQ3: '上四分位',
  boxMedian: '中位數',
  boxQ1: '下四分位',
  boxLow: '下限',
  boxOutliers: '異常值 {count} 個',
  box: '中位數 {median}，四分位 {q1} ~ {q3}，範圍 {low} ~ {high}',
  legendHint: '按 Alt+Enter 或按住 Alt 點擊只顯示這一項，再按一次恢復全部',
  hiddenSlices: '已隱藏 {count} 項，占比只按顯示的部分計算',
  keys: '{summary}。用方向鍵逐個查看資料',
  zoomKeys: '{summary}。用方向鍵逐個查看資料，加號和減號縮放，0 復位',
  zoomed: '顯示 {from} 至 {to}',
  zoomReset: '顯示全部',
  rangeStart: '區間起點',
  rangeEnd: '區間終點',
  range: '{chart}，橫軸從 {from} 到 {to}',
  rangeDown: '{chart}，縱軸從 {from} 到 {to}',
  summary: '{chart}。{series}',
  empty: '沒有資料',
  table: '圖表資料',
  tableOf: '{names}的資料',
  nameSeparator: '、',
  tableSeries: '系列',
  tableValue: '值',
  tableShare: '佔比',
  stageRate: '轉化率',
  totalRate: '總轉化率',
  tableMore: '只顯示前 {shown} 列，共 {count} 列',
}

const en: ChartMessages = {
  chart: 'Chart',
  series: '{name}: {count} points, from {min} to {max}',
  seriesEmpty: '{name}: no data',
  heatmap: '{name}: {rows} rows, {columns} columns, from {min} to {max} ({at})',
  slice: '{label} {value} ({share})',
  pie: '{name}: {slices}',
  listSeparator: '; ',
  itemSeparator: ', ',
  share: '{value} ({share})',
  band: '{from} – {to}',
  waterfallStep: '{change}, total {total}',
  boxHigh: 'Upper whisker',
  boxQ3: 'Upper quartile',
  boxMedian: 'Median',
  boxQ1: 'Lower quartile',
  boxLow: 'Lower whisker',
  boxOutliers: '{count} outliers',
  box: 'median {median}, quartiles {q1} – {q3}, range {low} – {high}',
  legendHint: 'Alt+Enter or Alt+click shows only this one; again shows all',
  hiddenSlices: '{count} hidden; shares are of the slices shown',
  keys: '{summary}. Use the arrow keys to read each point',
  zoomKeys: '{summary}. Use the arrow keys to read each point, plus and minus to zoom, 0 to reset',
  zoomed: 'Showing {from} to {to}',
  zoomReset: 'Showing all',
  rangeStart: 'Range start',
  rangeEnd: 'Range end',
  range: '{chart}, x from {from} to {to}',
  rangeDown: '{chart}, x from {from} to {to}',
  summary: '{chart}. {series}',
  empty: 'No data',
  table: 'Chart data',
  tableOf: 'Data of {names}',
  nameSeparator: ', ',
  tableSeries: 'Series',
  tableValue: 'Value',
  tableShare: 'Share',
  stageRate: 'Conversion',
  totalRate: 'Overall',
  tableMore: 'Showing the first {shown} of {count} rows',
}

export const chartLocales: Record<string, ChartMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

export type ChartMessagesOverride = Partial<ChartMessages>

/**
 * The chart's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useChartMessages(override?: MaybeRefOrGetter<ChartMessagesOverride | undefined>) {
  const { locale } = useLocale()
  return computed<ChartMessages>(() => {
    const name = locale.value.name
    const base =
      chartLocales[name] ?? chartLocales[name.split('-')[0]!] ?? (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    return extra ? { ...base, ...extra } : base
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
