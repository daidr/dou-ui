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
  duplicate: string
  remove: string
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
  /** The button clearing that filter: `{value}`. */
  clearFilter: string
  /** The filter bar's accessible name. */
  filterBar: string
  /** A filter set by a widget, in the filter bar: `{title}` and `{value}`. */
  linkedFilter: string
  /** Clears every filter. */
  clearFilters: string
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
  duplicate: '复制一份',
  remove: '删除',
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
  clearFilter: '清除筛选：{value}',
  filterBar: '筛选',
  linkedFilter: '{title}：{value}',
  clearFilters: '清除筛选',
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
  duplicate: '複製一份',
  remove: '刪除',
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
  clearFilter: '清除篩選：{value}',
  filterBar: '篩選',
  linkedFilter: '{title}：{value}',
  clearFilters: '清除篩選',
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
  duplicate: 'Duplicate',
  remove: 'Remove',
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
  clearFilter: 'Clear filter: {value}',
  filterBar: 'Filters',
  linkedFilter: '{title}: {value}',
  clearFilters: 'Clear filters',
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
