import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface ChartMessages {
  /** The chart's accessible name when it has no `description`. */
  chart: string
  /** Read out for each series: `{name}`, `{count}` points, from `{min}` to `{max}`. */
  series: string
  /** Read out for a series without points: `{name}`. */
  seriesEmpty: string
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
}

const zhCN: ChartMessages = {
  chart: '图表',
  series: '{name}：{count} 个数据点，最小 {min}，最大 {max}',
  seriesEmpty: '{name}：没有数据',
  slice: '{label} {value}（{share}）',
  pie: '{name}：{slices}',
  listSeparator: '；',
  itemSeparator: '，',
  share: '{value}（{share}）',
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
}

const zhTW: ChartMessages = {
  chart: '圖表',
  series: '{name}：{count} 個資料點，最小 {min}，最大 {max}',
  seriesEmpty: '{name}：沒有資料',
  slice: '{label} {value}（{share}）',
  pie: '{name}：{slices}',
  listSeparator: '；',
  itemSeparator: '，',
  share: '{value}（{share}）',
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
}

const en: ChartMessages = {
  chart: 'Chart',
  series: '{name}: {count} points, from {min} to {max}',
  seriesEmpty: '{name}: no data',
  slice: '{label} {value} ({share})',
  pie: '{name}: {slices}',
  listSeparator: '; ',
  itemSeparator: ', ',
  share: '{value} ({share})',
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
