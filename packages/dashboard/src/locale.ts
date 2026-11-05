import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface DashboardMessages {
  /** The grid layout's accessible name. */
  layout: string
  /** What an item of the grid is called by a screen reader. */
  item: string
  /** Read after an item's name while the layout can be edited. */
  itemHint: string
  /** An item that can't be moved: `{item}`. */
  locked: string
  /** An item's place: `{x}` `{y}` (from 1), `{w}` `{h}` (in columns and rows). */
  position: string
  /** An item's place when the grid has one column: `{n}` of `{count}` (from 1). */
  order: string
  /** An item picked up with the keyboard: `{item}` and `{position}`. */
  grabbed: string
  /** An item put down, with the keyboard or the pointer: `{item}` and `{position}`. */
  dropped: string
  /** A move or resize undone with Escape (or a drop outside the grid): `{item}`. */
  cancelled: string
  /** The handle in an item's corner. */
  resize: string
  /** The dashboard's accessible name. */
  dashboard: string
  /** The menu button in a widget's title bar. */
  widgetMenu: string
  /** Menu items. */
  settings: string
  fullscreen: string
  /** The menu of file types a widget's content can be exported as. */
  export: string
  /** A failed export, over the widget's content: `{name}` (the file), `{reason}`. */
  exportFailed: string
  /** Read out once the file is saved: `{name}`. */
  exported: string
  /** Why a widget can't be exported: it has no data, such as a chart without its fields. */
  nothingToExport: string
  duplicate: string
  remove: string
  /** The comment button and the card of a widget's discussions. */
  comment: string
  /** The comment button of a widget with discussions; `{count}` is how many are open. */
  comments: string
  /** The settings drawer's title: `{title}`. */
  settingsTitle: string
  /** The title field in the settings drawer. */
  titleField: string
  /** Read when a widget is added, copied or removed: `{item}`. */
  added: string
  removed: string
  /** A widget whose type isn't registered: `{type}`. */
  unknownType: string
  /** A widget's status. */
  loading: string
  error: string
  empty: string
  retry: string
  /** A dashboard without widgets, while editing. */
  emptyTitle: string
  emptyHint: string
  /** The list of widgets to add. */
  palette: string
  /** A widget in that list: `{label}`. */
  paletteItem: string
  /** In the title bar of a widget that set a filter: `{value}`. */
  filteredBy: string
  peerMoving: string
  peerResizing: string
  peerSettings: string
  /** The button clearing that filter: `{value}`. */
  clearFilter: string
  /** The filter bar's accessible name. */
  filterBar: string
  /** A filter set by a widget, in the filter bar: `{title}` and `{value}`. */
  linkedFilter: string
  /** Clears every filter. */
  clearFilters: string
  /** Settings of the built-in widgets. */
  source: string
  noSource: string
  field: string
  value: string
  prefix: string
  suffix: string
  precision: string
  trend: string
  delta: string
  /** The change under a number: `{value}`, e.g. `+12.5%`. */
  deltaText: string
  text: string
  textSize: string
  sizeSmall: string
  sizeMedium: string
  sizeLarge: string
  columns: string
  /** The title of a table column, while it has none: `{field}`. */
  columnTitle: string
  chartKind: string
  chartLine: string
  chartArea: string
  chartBar: string
  chartPie: string
  xField: string
  yFields: string
  stacked: string
  horizontal: string
  /** The filter set by clicking a chart. */
  chartFilter: string
  chartFilterHint: string
  /** Whether clicking a pivot table's cell filters the other widgets. */
  pivotFilter: string
}

const zhCN: DashboardMessages = {
  layout: '网格布局',
  item: '格子',
  itemHint: '按 Enter 拿起，再用方向键移动、Shift 加方向键调整大小',
  locked: '{item} 已锁定，不能移动',
  position: '第 {x} 列第 {y} 行，宽 {w} 列，高 {h} 行',
  order: '第 {n} 个，共 {count} 个',
  grabbed: '已拿起 {item}，{position}。方向键移动，Shift 加方向键调整大小，Enter 放下，Esc 取消',
  dropped: '已放下 {item}，{position}',
  cancelled: '已取消，{item} 回到原处',
  resize: '调整大小',
  dashboard: '仪表盘',
  widgetMenu: '格子操作',
  settings: '设置',
  fullscreen: '全屏查看',
  export: '导出',
  exportFailed: '无法导出 {name}：{reason}',
  exported: '已导出 {name}',
  nothingToExport: '没有可导出的数据',
  duplicate: '复制一份',
  remove: '删除',
  comment: '评论',
  comments: '{count} 条评论',
  settingsTitle: '{title}的设置',
  titleField: '标题',
  added: '已添加 {item}',
  removed: '已删除 {item}',
  unknownType: '没有注册类型为 {type} 的格子',
  loading: '加载中',
  error: '加载失败',
  empty: '暂无数据',
  retry: '重试',
  emptyTitle: '还没有格子',
  emptyHint: '从列表里拖进来，或点一下添加',
  palette: '添加格子',
  paletteItem: '添加{label}',
  filteredBy: '已按 {value} 筛选',
  peerMoving: '{name} 正在移动',
  peerResizing: '{name} 正在调整大小',
  peerSettings: '{name} 正在修改设置',
  clearFilter: '清除筛选：{value}',
  filterBar: '筛选',
  linkedFilter: '{title}：{value}',
  clearFilters: '清除筛选',
  source: '数据源',
  noSource: '不使用数据源',
  field: '字段',
  value: '数值',
  prefix: '前缀',
  suffix: '后缀',
  precision: '小数位数',
  trend: '迷你图字段',
  delta: '变化率字段',
  deltaText: '较上期 {value}',
  text: '文字',
  textSize: '字号',
  sizeSmall: '小',
  sizeMedium: '中',
  sizeLarge: '大',
  columns: '列',
  columnTitle: '{field} 的标题',
  chartKind: '图表',
  chartLine: '折线图',
  chartArea: '面积图',
  chartBar: '柱状图',
  chartPie: '饼图',
  xField: '分类或时间',
  yFields: '数值',
  stacked: '堆叠',
  horizontal: '横向',
  chartFilter: '点击时筛选',
  chartFilterHint: '点图表里的一项时，用这个名字筛选其他格子；留空则不筛选',
  pivotFilter: '点击单元格时，按它所在的分组筛选其他格子',
}

const zhTW: DashboardMessages = {
  layout: '網格版面',
  item: '格子',
  itemHint: '按 Enter 拿起，再用方向鍵移動、Shift 加方向鍵調整大小',
  locked: '{item} 已鎖定，無法移動',
  position: '第 {x} 欄第 {y} 列，寬 {w} 欄，高 {h} 列',
  order: '第 {n} 個，共 {count} 個',
  grabbed: '已拿起 {item}，{position}。方向鍵移動，Shift 加方向鍵調整大小，Enter 放下，Esc 取消',
  dropped: '已放下 {item}，{position}',
  cancelled: '已取消，{item} 回到原處',
  resize: '調整大小',
  dashboard: '儀表板',
  widgetMenu: '格子操作',
  settings: '設定',
  fullscreen: '全螢幕檢視',
  export: '匯出',
  exportFailed: '無法匯出 {name}：{reason}',
  exported: '已匯出 {name}',
  nothingToExport: '沒有可匯出的資料',
  duplicate: '複製一份',
  remove: '刪除',
  comment: '評論',
  comments: '{count} 則評論',
  settingsTitle: '{title}的設定',
  titleField: '標題',
  added: '已新增 {item}',
  removed: '已刪除 {item}',
  unknownType: '沒有註冊類型為 {type} 的格子',
  loading: '載入中',
  error: '載入失敗',
  empty: '暫無資料',
  retry: '重試',
  emptyTitle: '還沒有格子',
  emptyHint: '從清單拖進來，或點一下新增',
  palette: '新增格子',
  paletteItem: '新增{label}',
  filteredBy: '已按 {value} 篩選',
  peerMoving: '{name} 正在移動',
  peerResizing: '{name} 正在調整大小',
  peerSettings: '{name} 正在修改設定',
  clearFilter: '清除篩選：{value}',
  filterBar: '篩選',
  linkedFilter: '{title}：{value}',
  clearFilters: '清除篩選',
  source: '資料來源',
  noSource: '不使用資料來源',
  field: '欄位',
  value: '數值',
  prefix: '前綴',
  suffix: '後綴',
  precision: '小數位數',
  trend: '迷你圖欄位',
  delta: '變化率欄位',
  deltaText: '較上期 {value}',
  text: '文字',
  textSize: '字號',
  sizeSmall: '小',
  sizeMedium: '中',
  sizeLarge: '大',
  columns: '欄',
  columnTitle: '{field} 的標題',
  chartKind: '圖表',
  chartLine: '折線圖',
  chartArea: '面積圖',
  chartBar: '長條圖',
  chartPie: '圓餅圖',
  xField: '分類或時間',
  yFields: '數值',
  stacked: '堆疊',
  horizontal: '橫向',
  chartFilter: '點擊時篩選',
  chartFilterHint: '點圖表裡的一項時，用這個名字篩選其他格子；留空則不篩選',
  pivotFilter: '點擊儲存格時，依其所在的分組篩選其他格子',
}

const en: DashboardMessages = {
  layout: 'Grid layout',
  item: 'tile',
  itemHint: 'Press Enter to pick up, then arrow keys to move and Shift with arrow keys to resize',
  locked: '{item} is locked and can’t be moved',
  position: 'column {x}, row {y}, {w} columns wide, {h} rows high',
  order: '{n} of {count}',
  grabbed:
    'Picked up {item}, {position}. Arrow keys move, Shift with arrow keys resizes, Enter puts down, Escape cancels',
  dropped: 'Put down {item}, {position}',
  cancelled: 'Cancelled, {item} is back where it was',
  resize: 'Resize',
  dashboard: 'Dashboard',
  widgetMenu: 'Widget actions',
  settings: 'Settings',
  fullscreen: 'View full screen',
  export: 'Export',
  exportFailed: "Couldn't export {name}: {reason}",
  exported: 'Exported {name}',
  nothingToExport: 'There is no data to export',
  duplicate: 'Duplicate',
  remove: 'Remove',
  comment: 'Comment',
  comments: '{count} comments',
  settingsTitle: '{title} settings',
  titleField: 'Title',
  added: 'Added {item}',
  removed: 'Removed {item}',
  unknownType: 'No widget type “{type}” is registered',
  loading: 'Loading',
  error: 'Couldn’t load',
  empty: 'No data',
  retry: 'Retry',
  emptyTitle: 'No widgets yet',
  emptyHint: 'Drag one in from the list, or click to add it',
  palette: 'Add widget',
  paletteItem: 'Add {label}',
  filteredBy: 'Filtered by {value}',
  peerMoving: '{name} is moving it',
  peerResizing: '{name} is resizing it',
  peerSettings: '{name} is changing its settings',
  clearFilter: 'Clear filter: {value}',
  filterBar: 'Filters',
  linkedFilter: '{title}: {value}',
  clearFilters: 'Clear filters',
  source: 'Source',
  noSource: 'No source',
  field: 'Field',
  value: 'Value',
  prefix: 'Prefix',
  suffix: 'Suffix',
  precision: 'Decimal places',
  trend: 'Sparkline field',
  delta: 'Change field',
  deltaText: '{value} vs. last period',
  text: 'Text',
  textSize: 'Size',
  sizeSmall: 'Small',
  sizeMedium: 'Medium',
  sizeLarge: 'Large',
  columns: 'Columns',
  columnTitle: 'Title of {field}',
  chartKind: 'Chart',
  chartLine: 'Line',
  chartArea: 'Area',
  chartBar: 'Bar',
  chartPie: 'Pie',
  xField: 'Category or time',
  yFields: 'Values',
  stacked: 'Stacked',
  horizontal: 'Horizontal',
  chartFilter: 'Filter on click',
  chartFilterHint:
    'Clicking an item filters the other widgets by this name; leave empty to not filter',
  pivotFilter: 'Clicking a cell filters the other widgets by its groups',
}

export const dashboardLocales: Record<string, DashboardMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

export type DashboardMessagesOverride = Partial<DashboardMessages>

/**
 * The dashboard's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useDashboardMessages(
  override?: MaybeRefOrGetter<DashboardMessagesOverride | undefined>,
) {
  const { locale } = useLocale()
  return computed<DashboardMessages>(() => {
    const name = locale.value.name
    const base =
      dashboardLocales[name] ??
      dashboardLocales[name.split('-')[0]!] ??
      (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    return extra ? { ...base, ...extra } : base
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
