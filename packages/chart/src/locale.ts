import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface ChartMessages {
  /** The chart's accessible name when it has no `description`. */
  chart: string
  /** Read out for each series: `{name}`, `{count}` points, from `{min}` to `{max}`. */
  series: string
  /** Read out for a series without points: `{name}`. */
  seriesEmpty: string
  /** Joins the series in the summary. */
  listSeparator: string
  /** The summary: `{chart}` and `{series}` (the series joined). */
  summary: string
}

const zhCN: ChartMessages = {
  chart: '图表',
  series: '{name}：{count} 个数据点，最小 {min}，最大 {max}',
  seriesEmpty: '{name}：没有数据',
  listSeparator: '；',
  summary: '{chart}。{series}',
}

const zhTW: ChartMessages = {
  chart: '圖表',
  series: '{name}：{count} 個資料點，最小 {min}，最大 {max}',
  seriesEmpty: '{name}：沒有資料',
  listSeparator: '；',
  summary: '{chart}。{series}',
}

const en: ChartMessages = {
  chart: 'Chart',
  series: '{name}: {count} points, from {min} to {max}',
  seriesEmpty: '{name}: no data',
  listSeparator: '; ',
  summary: '{chart}. {series}',
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
