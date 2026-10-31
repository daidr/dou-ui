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
