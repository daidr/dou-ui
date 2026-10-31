import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface PivotMessages {
  /** The table's accessible name. */
  pivot: string
  /** The grand total row and column. */
  total: string
  /** The column with an open group's total: `{label}`. */
  subtotal: string
  /** The group of records without a value. */
  empty: string
  yes: string
  no: string
  /** The header of a value: `{field}` and `{aggregate}`. Sums are headed by the field alone. */
  value: string
  /** The header of the column of value names, when the values run down the rows. */
  values: string
  /** The words for the built-in ways to sum up. */
  aggregates: Record<'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinct' | 'median', string>
  expand: string
  collapse: string
  /** On a field name in the corner: `{field}`. */
  sortField: string
  /** On a value header: what clicking does. */
  sortValue: string
  /** Shown, and read out, when no record passes the filters. */
  noData: string
}

const zhCN: PivotMessages = {
  pivot: '数据透视表',
  total: '总计',
  subtotal: '{label} 合计',
  empty: '（空）',
  yes: '是',
  no: '否',
  value: '{field} · {aggregate}',
  values: '值',
  aggregates: {
    sum: '求和',
    count: '计数',
    avg: '平均值',
    min: '最小值',
    max: '最大值',
    distinct: '去重计数',
    median: '中位数',
  },
  expand: '展开',
  collapse: '折叠',
  sortField: '按{field}排序',
  sortValue: '按这一列排序',
  noData: '没有数据',
}

const zhTW: PivotMessages = {
  pivot: '樞紐分析表',
  total: '總計',
  subtotal: '{label} 合計',
  empty: '（空）',
  yes: '是',
  no: '否',
  value: '{field} · {aggregate}',
  values: '值',
  aggregates: {
    sum: '加總',
    count: '計數',
    avg: '平均值',
    min: '最小值',
    max: '最大值',
    distinct: '不重複計數',
    median: '中位數',
  },
  expand: '展開',
  collapse: '摺疊',
  sortField: '依{field}排序',
  sortValue: '依這一欄排序',
  noData: '沒有資料',
}

const en: PivotMessages = {
  pivot: 'Pivot table',
  total: 'Total',
  subtotal: '{label} total',
  empty: '(blank)',
  yes: 'Yes',
  no: 'No',
  value: '{aggregate} of {field}',
  values: 'Values',
  aggregates: {
    sum: 'Sum',
    count: 'Count',
    avg: 'Average',
    min: 'Min',
    max: 'Max',
    distinct: 'Distinct count',
    median: 'Median',
  },
  expand: 'Expand',
  collapse: 'Collapse',
  sortField: 'Sort by {field}',
  sortValue: 'Sort by this column',
  noData: 'No data',
}

export const pivotLocales: Record<string, PivotMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

export type PivotMessagesOverride = Partial<Omit<PivotMessages, 'aggregates'>> & {
  aggregates?: Partial<PivotMessages['aggregates']> & Record<string, string>
}

/**
 * The pivot table's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function usePivotMessages(override?: MaybeRefOrGetter<PivotMessagesOverride | undefined>) {
  const { locale } = useLocale()
  return computed<PivotMessages & { aggregates: Record<string, string> }>(() => {
    const name = locale.value.name
    const base =
      pivotLocales[name] ?? pivotLocales[name.split('-')[0]!] ?? (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    if (!extra) return base
    return { ...base, ...extra, aggregates: { ...base.aggregates, ...extra.aggregates } }
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
