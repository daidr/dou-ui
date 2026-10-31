import { useLocale } from 'dou-ui'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { ExpressionProblem } from './core/expression'
import type { DocumentProblem } from './core/check'

export interface FormBuilderMessages {
  /** Buttons of `steps`. */
  prev: string
  next: string
  /** The add button of a list, unless the list sets `addText`. */
  add: string
  /** The remove button of a list item, read out: `{index}` counts from 1. */
  remove: string
  /** The drag handle of a list item, read out: `{index}`. */
  move: string
  /** Names a list item: `{index}`. */
  item: string
  /** Shown in a list without items. */
  empty: string
  /** What an editor shows for each problem of an expression; `{text}` is the source at fault. */
  expression: Record<ExpressionProblem['code'], string>
  /** What an editor shows for each problem of a document; `{text}` is the id, name or type at fault. */
  document: Record<DocumentProblem['code'], string>
}

const zhCN: FormBuilderMessages = {
  prev: '上一步',
  next: '下一步',
  add: '添加一项',
  remove: '删除第 {index} 项',
  move: '拖动第 {index} 项调整顺序',
  item: '第 {index} 项',
  empty: '还没有内容',
  expression: {
    'unexpected-character': '这里不能出现“{text}”',
    'unterminated-string': '文字缺少结尾的引号',
    'unexpected-token': '这里不能出现“{text}”',
    'unexpected-end': '表达式还没写完',
    'unknown-name': '读取字段请写成 values.{text}',
    assignment: '比较请用 ==',
    'too-deep': '表达式嵌套太深',
    'too-long': '表达式太长',
    'unknown-field': '没有字段“{text}”',
    'unknown-function': '没有函数“{text}”',
  },
  document: {
    version: '不认识第 {text} 版的描述',
    'duplicate-id': '节点 id“{text}”重复了',
    'missing-name': '字段缺少字段名',
    'duplicate-name': '字段名“{text}”重复了',
    'unknown-type': '没有“{text}”这种字段',
    'misplaced-page': '页面只能放在标签页或分步里',
    'not-a-page': '标签页和分步里只能放页面',
    expression: '表达式有误：{text}',
    'formula-cycle': '公式互相引用：{text}',
  },
}

const zhTW: FormBuilderMessages = {
  prev: '上一步',
  next: '下一步',
  add: '新增一項',
  remove: '刪除第 {index} 項',
  move: '拖曳第 {index} 項調整順序',
  item: '第 {index} 項',
  empty: '還沒有內容',
  expression: {
    'unexpected-character': '這裡不能出現「{text}」',
    'unterminated-string': '文字缺少結尾的引號',
    'unexpected-token': '這裡不能出現「{text}」',
    'unexpected-end': '運算式還沒寫完',
    'unknown-name': '讀取欄位請寫成 values.{text}',
    assignment: '比較請用 ==',
    'too-deep': '運算式巢狀太深',
    'too-long': '運算式太長',
    'unknown-field': '沒有欄位「{text}」',
    'unknown-function': '沒有函式「{text}」',
  },
  document: {
    version: '不認得第 {text} 版的描述',
    'duplicate-id': '節點 id「{text}」重複了',
    'missing-name': '欄位缺少欄位名稱',
    'duplicate-name': '欄位名稱「{text}」重複了',
    'unknown-type': '沒有「{text}」這種欄位',
    'misplaced-page': '頁面只能放在分頁或分步裡',
    'not-a-page': '分頁和分步裡只能放頁面',
    expression: '運算式有誤：{text}',
    'formula-cycle': '公式互相引用：{text}',
  },
}

const en: FormBuilderMessages = {
  prev: 'Back',
  next: 'Next',
  add: 'Add',
  remove: 'Remove item {index}',
  move: 'Drag item {index} to reorder',
  item: 'Item {index}',
  empty: 'Nothing here yet',
  expression: {
    'unexpected-character': '“{text}” can’t go here',
    'unterminated-string': 'The text is missing its closing quote',
    'unexpected-token': '“{text}” can’t go here',
    'unexpected-end': 'The expression ends too early',
    'unknown-name': 'Read fields as values.{text}',
    assignment: 'Use == to compare',
    'too-deep': 'The expression nests too deeply',
    'too-long': 'The expression is too long',
    'unknown-field': 'There is no field “{text}”',
    'unknown-function': 'There is no function “{text}”',
  },
  document: {
    version: 'Version {text} of the document is not known',
    'duplicate-id': 'The node id “{text}” is used twice',
    'missing-name': 'The field has no name',
    'duplicate-name': 'The field name “{text}” is used twice',
    'unknown-type': 'There is no field type “{text}”',
    'misplaced-page': 'A page belongs in tabs or steps',
    'not-a-page': 'Tabs and steps hold pages only',
    expression: 'The expression is wrong: {text}',
    'formula-cycle': 'The formulas read each other: {text}',
  },
}

export const formBuilderLocales: Record<string, FormBuilderMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/** Texts to change; the `expression` and `document` groups are merged, so only the ones given are replaced. */
export type FormBuilderMessagesOverride = {
  [K in keyof FormBuilderMessages]?: FormBuilderMessages[K] extends string
    ? string
    : Partial<FormBuilderMessages[K]>
}

/** The form builder's texts, picked by the name of DouUI's current locale. */
export function useFormBuilderMessages(
  override?: MaybeRefOrGetter<FormBuilderMessagesOverride | undefined>,
) {
  const { locale } = useLocale()
  return computed<FormBuilderMessages>(() => {
    const name = locale.value.name
    const base =
      formBuilderLocales[name] ??
      formBuilderLocales[name.split('-')[0]!] ??
      (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    if (!extra) return base
    return {
      ...base,
      ...extra,
      expression: { ...base.expression, ...extra.expression },
      document: { ...base.document, ...extra.document },
    } as FormBuilderMessages
  })
}

/** Fills `{name}` placeholders. */
export const formatMessage = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
