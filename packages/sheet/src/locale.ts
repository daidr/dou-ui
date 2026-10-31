import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface SheetMessages {
  /** The grid's accessible name when none is given. */
  sheet: string
  /** The corner above the row numbers, which selects everything. */
  selectAll: string
  /** Read out for the cell the keyboard is on: `{cell}` is its name, `{value}` what it shows. */
  cell: string
  /** Read out for an empty cell instead of its value. */
  empty: string
  /** Read out when more than one cell is selected: `{range}`, `{count}` cells. */
  selected: string
  /** The cell editor's name: `{cell}`. */
  edit: string
  /** How to use the grid with keys; read out when it gets focus. */
  keys: string
  /** Read out when the grid can't be changed and something tried to. */
  readonly: string
  /** Read out after clearing: `{range}`. */
  cleared: string
  /** Read out after an edit: `{cell}`, `{value}`. */
  changed: string
  undone: string
  redone: string
}

const zhCN: SheetMessages = {
  sheet: '电子表格',
  selectAll: '全选',
  cell: '{cell}，{value}',
  empty: '空',
  selected: '已选择 {range}，共 {count} 个单元格',
  edit: '编辑 {cell}',
  keys: '方向键移动，Shift 加方向键扩大选区，输入内容或按 F2 编辑，Enter 确认，Esc 取消，Delete 清空。',
  readonly: '表格是只读的',
  cleared: '已清空 {range}',
  changed: '{cell} 改为 {value}',
  undone: '已撤销',
  redone: '已重做',
}

const zhTW: SheetMessages = {
  sheet: '試算表',
  selectAll: '全選',
  cell: '{cell}，{value}',
  empty: '空白',
  selected: '已選取 {range}，共 {count} 個儲存格',
  edit: '編輯 {cell}',
  keys: '方向鍵移動，Shift 加方向鍵擴大選取範圍，輸入內容或按 F2 編輯，Enter 確認，Esc 取消，Delete 清除。',
  readonly: '試算表是唯讀的',
  cleared: '已清除 {range}',
  changed: '{cell} 改為 {value}',
  undone: '已復原',
  redone: '已重做',
}

const en: SheetMessages = {
  sheet: 'Spreadsheet',
  selectAll: 'Select all',
  cell: '{cell}, {value}',
  empty: 'empty',
  selected: '{range} selected, {count} cells',
  edit: 'Edit {cell}',
  keys: 'Arrow keys move, Shift and an arrow extend the selection, type or press F2 to edit, Enter to confirm, Escape to cancel, Delete to clear.',
  readonly: 'The spreadsheet is read-only',
  cleared: '{range} cleared',
  changed: '{cell} is now {value}',
  undone: 'Undone',
  redone: 'Redone',
}

export const sheetLocales: Record<string, SheetMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/**
 * The spreadsheet's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useSheetMessages(override?: MaybeRefOrGetter<Partial<SheetMessages> | undefined>) {
  const { locale } = useLocale()
  return computed<SheetMessages>(() => {
    const name = locale.value.name
    const base =
      sheetLocales[name] ?? sheetLocales[name.split('-')[0]!] ?? (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    if (!extra) return base
    const out = { ...base }
    for (const [key, value] of Object.entries(extra))
      if (value !== undefined) out[key as keyof SheetMessages] = value
    return out
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
