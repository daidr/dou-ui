import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface CodeMessages {
  /** The marker of a folded block, as a tooltip. */
  unfold: string
  /** Read out after folding: `{from}`, `{to}` are the hidden lines. */
  folded: string
  unfolded: string
  foldedAll: string
  unfoldedAll: string
  /** The toolbar over a selection on touch screens. */
  editMenu: string
  cut: string
  copy: string
  paste: string
  selectAll: string
  /** Toolbar button of a language server (`@dou-ui/code/lsp`): go to where the name is defined. */
  goToDefinition: string
  /** The bar of symbol keys above a phone's keyboard. */
  keys: string
  /** The Tab key on that bar. */
  indent: string
  cursorLeft: string
  cursorRight: string
  cursorUp: string
  cursorDown: string
  undo: string
  redo: string
  error: string
  warning: string
  info: string
  hint: string
  /** The box with the problems at a place in the text. */
  problems: string
  /** Read out when the cursor moves to a problem: `{line}`, `{severity}`, `{message}`. */
  problemAt: string
  /** Read out when a fix or a completion is picked: `{label}`, `{index}`, `{count}`. */
  itemAt: string
  /** The box with the text about a place, and its problems. */
  details: string
  /** The completion list. */
  completions: string
  /** The box with the parameters of a call. */
  signature: string
  /** The diff view's name. */
  diff: string
  /** The original side's label. */
  diffOriginal: string
  /** The modified side's label. */
  diffModified: string
  diffPrevious: string
  diffNext: string
  /** Shows the two sides next to each other. */
  diffSplit: string
  /** Shows the changes in one column. */
  diffInline: string
  /** Shows all the unchanged lines. */
  diffExpandAll: string
  /** Hides the unchanged lines again. */
  diffCollapse: string
  /** The bar over hidden unchanged lines: `{count}`. */
  diffUnchanged: string
  /** How many lines were added and removed: `{added}`, `{removed}`. */
  diffStats: string
  diffNoChanges: string
  /** A removed line, in the gutter. */
  diffRemoved: string
  /** An added line, in the gutter. */
  diffAdded: string
  /** Read out when moving to a change: `{index}`, `{count}`, `{line}`, `{removed}`, `{added}`. */
  diffChangeAt: string
}

export const zhCN: CodeMessages = {
  unfold: '展开',
  folded: '已折叠第 {from}–{to} 行',
  unfolded: '已展开',
  foldedAll: '已全部折叠',
  unfoldedAll: '已全部展开',
  editMenu: '编辑',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  selectAll: '全选',
  goToDefinition: '跳到定义',
  keys: '符号栏',
  indent: '缩进',
  cursorLeft: '光标左移',
  cursorRight: '光标右移',
  cursorUp: '光标上移',
  cursorDown: '光标下移',
  undo: '撤销',
  redo: '重做',
  error: '错误',
  warning: '警告',
  info: '信息',
  hint: '提示',
  problems: '问题',
  problemAt: '第 {line} 行，{severity}：{message}',
  itemAt: '{label}，第 {index} 项，共 {count} 项',
  details: '说明',
  completions: '补全',
  signature: '参数提示',
  diff: '对比',
  diffOriginal: '原文',
  diffModified: '修改后',
  diffPrevious: '上一处改动',
  diffNext: '下一处改动',
  diffSplit: '并排显示',
  diffInline: '行内显示',
  diffExpandAll: '展开全部',
  diffCollapse: '折叠未改动的行',
  diffUnchanged: '{count} 行未改动',
  diffStats: '新增 {added} 行，删除 {removed} 行',
  diffNoChanges: '没有改动',
  diffRemoved: '删除',
  diffAdded: '新增',
  diffChangeAt:
    '第 {index} 处改动，共 {count} 处，第 {line} 行：删除 {removed} 行，新增 {added} 行',
}

export const zhTW: CodeMessages = {
  unfold: '展開',
  folded: '已摺疊第 {from}–{to} 行',
  unfolded: '已展開',
  foldedAll: '已全部摺疊',
  unfoldedAll: '已全部展開',
  editMenu: '編輯',
  cut: '剪下',
  copy: '拷貝',
  paste: '貼上',
  selectAll: '全選',
  goToDefinition: '跳至定義',
  keys: '符號列',
  indent: '縮排',
  cursorLeft: '游標左移',
  cursorRight: '游標右移',
  cursorUp: '游標上移',
  cursorDown: '游標下移',
  undo: '復原',
  redo: '重做',
  error: '錯誤',
  warning: '警告',
  info: '資訊',
  hint: '提示',
  problems: '問題',
  problemAt: '第 {line} 行，{severity}：{message}',
  itemAt: '{label}，第 {index} 項，共 {count} 項',
  details: '說明',
  completions: '自動完成',
  signature: '參數提示',
  diff: '對比',
  diffOriginal: '原文',
  diffModified: '修改後',
  diffPrevious: '上一處改動',
  diffNext: '下一處改動',
  diffSplit: '並排顯示',
  diffInline: '行內顯示',
  diffExpandAll: '展開全部',
  diffCollapse: '摺疊未改動的行',
  diffUnchanged: '{count} 行未改動',
  diffStats: '新增 {added} 行，刪除 {removed} 行',
  diffNoChanges: '沒有改動',
  diffRemoved: '刪除',
  diffAdded: '新增',
  diffChangeAt:
    '第 {index} 處改動，共 {count} 處，第 {line} 行：刪除 {removed} 行，新增 {added} 行',
}

export const en: CodeMessages = {
  unfold: 'Unfold',
  folded: 'Folded lines {from}–{to}',
  unfolded: 'Unfolded',
  foldedAll: 'Folded all',
  unfoldedAll: 'Unfolded all',
  editMenu: 'Edit',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select all',
  goToDefinition: 'Go to definition',
  keys: 'Symbols',
  indent: 'Indent',
  cursorLeft: 'Move left',
  cursorRight: 'Move right',
  cursorUp: 'Move up',
  cursorDown: 'Move down',
  undo: 'Undo',
  redo: 'Redo',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  hint: 'Hint',
  problems: 'Problems',
  problemAt: 'Line {line}, {severity}: {message}',
  itemAt: '{label}, {index} of {count}',
  details: 'Details',
  completions: 'Suggestions',
  signature: 'Parameter hints',
  diff: 'Diff',
  diffOriginal: 'Original',
  diffModified: 'Modified',
  diffPrevious: 'Previous change',
  diffNext: 'Next change',
  diffSplit: 'Side by side',
  diffInline: 'Inline',
  diffExpandAll: 'Expand all',
  diffCollapse: 'Collapse unchanged lines',
  diffUnchanged: '{count} unchanged lines',
  diffStats: '{added} added, {removed} removed',
  diffNoChanges: 'No changes',
  diffRemoved: 'Removed',
  diffAdded: 'Added',
  diffChangeAt: 'Change {index} of {count}, line {line}: {removed} removed, {added} added',
}

export const codeLocales: Record<string, CodeMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/** The code editor's texts, picked by the name of DouUI's current locale. Pass `messages` to override any of them. */
export function useCodeMessages(override?: MaybeRefOrGetter<Partial<CodeMessages> | undefined>) {
  const { locale } = useLocale()
  return computed<CodeMessages>(() => {
    const name = locale.value.name
    const base =
      codeLocales[name] ?? codeLocales[name.split('-')[0]!] ?? (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    if (!extra) return base
    const out = { ...base }
    for (const [key, value] of Object.entries(extra))
      if (value !== undefined) out[key as keyof CodeMessages] = value
    return out
  })
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
