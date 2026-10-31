import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface CodeMessages {
  /** The search panel's name. */
  search: string
  /** The search box. */
  find: string
  /** The replace box. */
  replace: string
  /** Shows or hides the replace box. */
  toggleReplace: string
  caseSensitive: string
  wholeWord: string
  regexp: string
  previous: string
  next: string
  /** Replaces the current match. */
  replaceOne: string
  replaceAll: string
  close: string
  /** Where the current match is among all: `{index}`, `{count}`. */
  matchIndex: string
  /** How many matches, when none is current: `{count}`. */
  matchCount: string
  /** More matches than are counted: `{count}`+. */
  matchMany: string
  noMatches: string
  /** The regular expression can't be read. */
  invalidRegexp: string
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
  /** Read out after replacing: `{count}`. */
  replaced: string
}

export const zhCN: CodeMessages = {
  search: '查找和替换',
  find: '查找',
  replace: '替换为',
  toggleReplace: '显示替换',
  caseSensitive: '区分大小写',
  wholeWord: '全词匹配',
  regexp: '正则表达式',
  previous: '上一个',
  next: '下一个',
  replaceOne: '替换',
  replaceAll: '全部替换',
  close: '关闭',
  matchIndex: '{index}/{count}',
  matchCount: '共 {count} 个',
  matchMany: '超过 {count} 个',
  noMatches: '无结果',
  invalidRegexp: '正则表达式有误',
  replaced: '已替换 {count} 处',
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
}

export const zhTW: CodeMessages = {
  search: '尋找和取代',
  find: '尋找',
  replace: '取代為',
  toggleReplace: '顯示取代',
  caseSensitive: '區分大小寫',
  wholeWord: '全字相符',
  regexp: '規則運算式',
  previous: '上一個',
  next: '下一個',
  replaceOne: '取代',
  replaceAll: '全部取代',
  close: '關閉',
  matchIndex: '{index}/{count}',
  matchCount: '共 {count} 個',
  matchMany: '超過 {count} 個',
  noMatches: '無結果',
  invalidRegexp: '規則運算式有誤',
  replaced: '已取代 {count} 處',
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
}

export const en: CodeMessages = {
  search: 'Find and replace',
  find: 'Find',
  replace: 'Replace with',
  toggleReplace: 'Show replace',
  caseSensitive: 'Match case',
  wholeWord: 'Whole word',
  regexp: 'Regular expression',
  previous: 'Previous',
  next: 'Next',
  replaceOne: 'Replace',
  replaceAll: 'Replace all',
  close: 'Close',
  matchIndex: '{index}/{count}',
  matchCount: '{count} matches',
  matchMany: 'Over {count}',
  noMatches: 'No results',
  invalidRegexp: 'Invalid regular expression',
  replaced: 'Replaced {count}',
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
