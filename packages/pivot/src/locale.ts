import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { PivotFormulaErrorCode } from './engine/formula'
import type { PivotShowAs } from './engine/types'

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
  /** The ways of showing a value: after the value's name in its header, and in the menu. */
  shows: Record<PivotShowAs, string>
  /** The header of a value with a `show`: `{value}` and `{show}`. */
  shownValue: string
  expand: string
  collapse: string
  /** On a field name in the corner: `{field}`. */
  sortField: string
  /** On a value header: what clicking does. */
  sortValue: string
  /** Shown, and read out, when no record passes the filters. */
  noData: string
  /** Shown over the table while a worker sums up. */
  busy: string
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
    /** The submenu of a value's ways of showing, and its first item (as summed up). */
    showAs: string
    showPlain: string
    /** The submenu of a value's marks. */
    mark: string
    noMark: string
    bar: string
    scale: string
    /** The submenu that keeps the groups with the largest (or smallest) totals: `{count}`. */
    top: string
    topN: string
    bottomN: string
    noTop: string
    /** A chip whose field keeps only some groups by their totals: `{field}` and `{top}`. */
    topped: string
    /** A range of totals on a chip: `{range}`. */
    between: string
    /** The item that opens the dialog for any number, or a range of totals. */
    customTop: string
    /** The button that adds a calculated value, and the item that changes one. */
    addFormula: string
    editFormula: string
    /** The button that opens the panel in a drawer on a narrow screen. */
    open: string
  }
  /** The dialog that keeps the groups of a field by their totals. */
  topDialog: {
    /** `{field}` */
    title: string
    top: string
    bottom: string
    between: string
    /** Which value's totals rank the groups. */
    by: string
    count: string
    min: string
    max: string
    help: string
    clear: string
    apply: string
    cancel: string
  }
  /** The dialog that writes a calculated value. */
  formula: {
    title: string
    name: string
    /** In the name box: what the header says when it is left empty. */
    namePlaceholder: string
    formula: string
    placeholder: string
    /** Under the box: how to write a formula. */
    help: string
    /** The list of fields to put in the formula. */
    fields: string
    apply: string
    cancel: string
    /** Why the formula cannot be used: `{detail}` is the text it is about. */
    errors: Record<PivotFormulaErrorCode, string>
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
  shows: {
    percentOfTotal: '占总计',
    percentOfRow: '占行合计',
    percentOfColumn: '占列合计',
    percentOfParent: '占上级',
    difference: '差值',
    percentDifference: '差值百分比',
    runningTotal: '累计',
    rank: '排名',
  },
  shownValue: '{value} · {show}',
  expand: '展开',
  collapse: '折叠',
  sortField: '按{field}排序',
  sortValue: '按这一列排序',
  noData: '没有数据',
  busy: '正在汇总…',
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
    showAs: '显示方式',
    showPlain: '原值',
    mark: '条件格式',
    noMark: '无',
    bar: '数据条',
    scale: '色阶',
    top: '前 N 项',
    topN: '前 {count} 项',
    bottomN: '后 {count} 项',
    noTop: '不限',
    topped: '{field} · {top}',
    between: '合计 {range}',
    customTop: '自定义…',
    addFormula: '添加计算值',
    editFormula: '编辑公式…',
    open: '字段',
  },
  topDialog: {
    title: '按合计筛选{field}',
    top: '前 N 项',
    bottom: '后 N 项',
    between: '合计范围',
    by: '按',
    count: '项数',
    min: '最小',
    max: '最大',
    help: '按合计保留组，被排除的组不计入总计。',
    clear: '不限',
    apply: '确定',
    cancel: '取消',
  },
  formula: {
    title: '计算值',
    name: '名称',
    namePlaceholder: '不填时用公式作名称',
    formula: '公式',
    placeholder: '如 (销售额 - 成本) / 销售额',
    help: '字段名表示它的合计，可以用 + - * / 和括号，也可以用 sum、avg、min、max、count。',
    fields: '插入字段',
    apply: '确定',
    cancel: '取消',
    errors: {
      empty: '请填写公式',
      incomplete: '公式不完整',
      unknownChar: '无法识别“{detail}”',
      unexpected: '这里不应出现“{detail}”',
      expected: '缺少“{detail}”',
      unclosedBracket: '缺少“]”',
      emptyName: '方括号里没有字段名',
      unknownFunction: '没有名为“{detail}”的函数',
      needsField: '{detail}() 里需要一个字段',
      needsName: '这里应当是字段名',
      unknownField: '没有名为“{detail}”的字段',
      notNumber: '“{detail}”不是数字字段',
    },
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
  shows: {
    percentOfTotal: '佔總計',
    percentOfRow: '佔列合計',
    percentOfColumn: '佔欄合計',
    percentOfParent: '佔上層',
    difference: '差異',
    percentDifference: '差異百分比',
    runningTotal: '累計',
    rank: '排名',
  },
  shownValue: '{value} · {show}',
  expand: '展開',
  collapse: '摺疊',
  sortField: '依{field}排序',
  sortValue: '依這一欄排序',
  noData: '沒有資料',
  busy: '正在彙總…',
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
    showAs: '值的顯示方式',
    showPlain: '原始值',
    mark: '設定格式化的條件',
    noMark: '無',
    bar: '資料橫條',
    scale: '色階',
    top: '前 N 項',
    topN: '前 {count} 項',
    bottomN: '後 {count} 項',
    noTop: '不限',
    topped: '{field} · {top}',
    between: '合計 {range}',
    customTop: '自訂…',
    addFormula: '新增計算值',
    editFormula: '編輯公式…',
    open: '欄位',
  },
  topDialog: {
    title: '依合計篩選{field}',
    top: '前 N 項',
    bottom: '後 N 項',
    between: '合計範圍',
    by: '依',
    count: '項數',
    min: '最小',
    max: '最大',
    help: '依合計保留群組，被排除的群組不計入總計。',
    clear: '不限',
    apply: '確定',
    cancel: '取消',
  },
  formula: {
    title: '計算值',
    name: '名稱',
    namePlaceholder: '不填時以公式作為名稱',
    formula: '公式',
    placeholder: '如 (銷售額 - 成本) / 銷售額',
    help: '欄位名稱代表它的合計，可以用 + - * / 和括號，也可以用 sum、avg、min、max、count。',
    fields: '插入欄位',
    apply: '確定',
    cancel: '取消',
    errors: {
      empty: '請填寫公式',
      incomplete: '公式不完整',
      unknownChar: '無法辨識「{detail}」',
      unexpected: '這裡不應出現「{detail}」',
      expected: '缺少「{detail}」',
      unclosedBracket: '缺少「]」',
      emptyName: '方括號裡沒有欄位名稱',
      unknownFunction: '沒有名為「{detail}」的函式',
      needsField: '{detail}() 裡需要一個欄位',
      needsName: '這裡應該是欄位名稱',
      unknownField: '沒有名為「{detail}」的欄位',
      notNumber: '「{detail}」不是數字欄位',
    },
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
  shows: {
    percentOfTotal: '% of total',
    percentOfRow: '% of row',
    percentOfColumn: '% of column',
    percentOfParent: '% of parent',
    difference: 'Difference',
    percentDifference: '% difference',
    runningTotal: 'Running total',
    rank: 'Rank',
  },
  shownValue: '{value} ({show})',
  expand: 'Expand',
  collapse: 'Collapse',
  sortField: 'Sort by {field}',
  sortValue: 'Sort by this column',
  noData: 'No data',
  busy: 'Summing up…',
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
    showAs: 'Show values as',
    showPlain: 'No calculation',
    mark: 'Conditional format',
    noMark: 'None',
    bar: 'Data bars',
    scale: 'Color scale',
    top: 'Top N',
    topN: 'Top {count}',
    bottomN: 'Bottom {count}',
    noTop: 'All',
    topped: '{field} · {top}',
    between: 'Total {range}',
    customTop: 'Custom…',
    addFormula: 'Add calculated value',
    editFormula: 'Edit formula…',
    open: 'Fields',
  },
  topDialog: {
    title: 'Filter {field} by totals',
    top: 'Top N',
    bottom: 'Bottom N',
    between: 'Range',
    by: 'By',
    count: 'Count',
    min: 'Min',
    max: 'Max',
    help: 'Keeps groups by their totals; the groups left out are not in the totals.',
    clear: 'All',
    apply: 'Apply',
    cancel: 'Cancel',
  },
  formula: {
    title: 'Calculated value',
    name: 'Name',
    namePlaceholder: 'The formula, when left empty',
    formula: 'Formula',
    placeholder: 'e.g. (amount - cost) / amount',
    help: 'A field name stands for its total. Use + - * / and parentheses, or sum, avg, min, max and count.',
    fields: 'Insert field',
    apply: 'Apply',
    cancel: 'Cancel',
    errors: {
      empty: 'Enter a formula',
      incomplete: 'The formula is not complete',
      unknownChar: 'Unknown character "{detail}"',
      unexpected: 'Unexpected "{detail}"',
      expected: 'Missing "{detail}"',
      unclosedBracket: 'Missing "]"',
      emptyName: 'No field name in the brackets',
      unknownFunction: 'No function named "{detail}"',
      needsField: '{detail}() needs a field',
      needsName: 'A field name should go here',
      unknownField: 'No field named "{detail}"',
      notNumber: '"{detail}" is not a number field',
    },
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
  Omit<PivotMessages, 'aggregates' | 'shows' | 'fields' | 'topDialog' | 'formula' | 'filter'>
> & {
  aggregates?: Partial<PivotMessages['aggregates']> & Record<string, string>
  shows?: Partial<PivotMessages['shows']>
  fields?: Partial<PivotMessages['fields']>
  topDialog?: Partial<PivotMessages['topDialog']>
  formula?: Partial<Omit<PivotMessages['formula'], 'errors'>> & {
    errors?: Partial<PivotMessages['formula']['errors']>
  }
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
      shows: { ...base.shows, ...extra.shows },
      fields: { ...base.fields, ...extra.fields },
      topDialog: { ...base.topDialog, ...extra.topDialog },
      formula: {
        ...base.formula,
        ...extra.formula,
        errors: { ...base.formula.errors, ...extra.formula?.errors },
      },
      filter: { ...base.filter, ...extra.filter },
    }
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
