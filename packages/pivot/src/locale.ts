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
  /** Group labels when a date field is grouped by a period: `{year}`, `{quarter}`, `{week}`. */
  yearLabel: string
  quarterLabel: string
  weekLabel: string
  /** A range of numbers: `{from}` and `{to}`. */
  rangeLabel: string
  /** The line of an open group in the tabular layout that holds its total: `{label}`. */
  subtotalRow: string
  /** What dragging the edge of a column header does. */
  resizeColumn: string
  /** The accessible name of a column's resize handle: `{column}`. */
  columnWidth: string
  /** The field panel. */
  fields: {
    /** The panel's accessible name. */
    panel: string
    /** The list of all fields. */
    list: string
    search: string
    noFields: string
    areas: Record<'filters' | 'columns' | 'rows' | 'values', string>
    /** In an empty area. */
    dropHere: string
    /** On a field's menu button: `{field}`. */
    menu: string
    sort: string
    asc: string
    desc: string
    /** Sorting the row groups by a value's grand total: `{value}`. */
    byValueDesc: string
    byValueAsc: string
    groupBy: string
    noGroup: string
    periods: Record<'year' | 'quarter' | 'month' | 'week' | 'day', string>
    /** A grouping in ranges: `{step}`. */
    step: string
    /** A chip whose field is grouped: `{field}` and `{group}` (as in the grouping menu). */
    grouped: string
    subtotal: string
    aggregate: string
    filter: string
    /** On a field with a filter. */
    filtered: string
    /** The submenu that moves the field to another area. */
    moveTo: string
    /** Move the field one place up or down in its area (the order of the rows makes the levels). */
    moveUp: string
    moveDown: string
    remove: string
    /** In the values area: puts several values down the rows. */
    valuesOnRows: string
    /** The button that opens the panel in a drawer on a narrow screen. */
    open: string
  }
  /** The filter popover. */
  filter: {
    /** Its accessible name: `{field}`. */
    title: string
    search: string
    all: string
    noMatch: string
    apply: string
    cancel: string
    /** How many values are picked: `{picked}` of `{total}`. */
    count: string
  }
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
  yearLabel: '{year} 年',
  quarterLabel: '{year} 年 Q{quarter}',
  weekLabel: '{year} 年第 {week} 周',
  rangeLabel: '{from} – {to}',
  subtotalRow: '{label} 小计',
  resizeColumn: '拖动调整列宽，双击适应内容',
  columnWidth: '{column}的列宽',
  fields: {
    panel: '字段',
    list: '全部字段',
    search: '搜索字段',
    noFields: '没有匹配的字段',
    areas: { filters: '筛选', columns: '列', rows: '行', values: '值' },
    dropHere: '拖动字段到这里',
    menu: '{field}的选项',
    sort: '排序',
    asc: '升序',
    desc: '降序',
    byValueDesc: '按{value}从高到低',
    byValueAsc: '按{value}从低到高',
    groupBy: '分组',
    noGroup: '不分组',
    periods: { year: '按年', quarter: '按季度', month: '按月', week: '按周', day: '按日' },
    step: '每 {step} 一组',
    grouped: '{field} · {group}',
    subtotal: '显示小计',
    aggregate: '汇总方式',
    filter: '筛选…',
    filtered: '已筛选',
    moveTo: '移到',
    moveUp: '上移',
    moveDown: '下移',
    remove: '移除',
    valuesOnRows: '值放在行上',
    open: '字段',
  },
  filter: {
    title: '筛选{field}',
    search: '搜索',
    all: '全选',
    noMatch: '没有匹配的值',
    apply: '确定',
    cancel: '取消',
    count: '已选 {picked} / {total}',
  },
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
  yearLabel: '{year} 年',
  quarterLabel: '{year} 年 Q{quarter}',
  weekLabel: '{year} 年第 {week} 週',
  rangeLabel: '{from} – {to}',
  subtotalRow: '{label} 小計',
  resizeColumn: '拖曳調整欄寬，按兩下符合內容',
  columnWidth: '{column}的欄寬',
  fields: {
    panel: '欄位',
    list: '所有欄位',
    search: '搜尋欄位',
    noFields: '沒有符合的欄位',
    areas: { filters: '篩選', columns: '欄', rows: '列', values: '值' },
    dropHere: '拖曳欄位到這裡',
    menu: '{field}的選項',
    sort: '排序',
    asc: '遞增',
    desc: '遞減',
    byValueDesc: '依{value}由高到低',
    byValueAsc: '依{value}由低到高',
    groupBy: '分組',
    noGroup: '不分組',
    periods: { year: '依年', quarter: '依季', month: '依月', week: '依週', day: '依日' },
    step: '每 {step} 一組',
    grouped: '{field} · {group}',
    subtotal: '顯示小計',
    aggregate: '摘要方式',
    filter: '篩選…',
    filtered: '已篩選',
    moveTo: '移到',
    moveUp: '上移',
    moveDown: '下移',
    remove: '移除',
    valuesOnRows: '值放在列上',
    open: '欄位',
  },
  filter: {
    title: '篩選{field}',
    search: '搜尋',
    all: '全選',
    noMatch: '沒有符合的值',
    apply: '確定',
    cancel: '取消',
    count: '已選 {picked} / {total}',
  },
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
  yearLabel: '{year}',
  quarterLabel: 'Q{quarter} {year}',
  weekLabel: 'Week {week}, {year}',
  rangeLabel: '{from} – {to}',
  subtotalRow: '{label} subtotal',
  resizeColumn: 'Drag to resize, double-click to fit',
  columnWidth: 'Width of {column}',
  fields: {
    panel: 'Fields',
    list: 'All fields',
    search: 'Search fields',
    noFields: 'No matching fields',
    areas: { filters: 'Filters', columns: 'Columns', rows: 'Rows', values: 'Values' },
    dropHere: 'Drag fields here',
    menu: 'Options for {field}',
    sort: 'Sort',
    asc: 'Ascending',
    desc: 'Descending',
    byValueDesc: '{value}, high to low',
    byValueAsc: '{value}, low to high',
    groupBy: 'Group',
    noGroup: 'No grouping',
    periods: {
      year: 'By year',
      quarter: 'By quarter',
      month: 'By month',
      week: 'By week',
      day: 'By day',
    },
    step: 'Every {step}',
    grouped: '{field} · {group}',
    subtotal: 'Show subtotals',
    aggregate: 'Summarize by',
    filter: 'Filter…',
    filtered: 'Filtered',
    moveTo: 'Move to',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    valuesOnRows: 'Values on rows',
    open: 'Fields',
  },
  filter: {
    title: 'Filter {field}',
    search: 'Search',
    all: 'Select all',
    noMatch: 'No matching values',
    apply: 'Apply',
    cancel: 'Cancel',
    count: '{picked} of {total} selected',
  },
}

export const pivotLocales: Record<string, PivotMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

export type PivotMessagesOverride = Partial<
  Omit<PivotMessages, 'aggregates' | 'fields' | 'filter'>
> & {
  aggregates?: Partial<PivotMessages['aggregates']> & Record<string, string>
  fields?: Partial<PivotMessages['fields']>
  filter?: Partial<PivotMessages['filter']>
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
    return {
      ...base,
      ...extra,
      aggregates: { ...base.aggregates, ...extra.aggregates },
      fields: { ...base.fields, ...extra.fields },
      filter: { ...base.filter, ...extra.filter },
    }
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
