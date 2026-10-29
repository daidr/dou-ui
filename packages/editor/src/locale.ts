import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface EditorMessages {
  placeholder: string
  emptyPlaceholder: string
  headingPlaceholder: string
  /** Names of the block types, also shown in menus. */
  types: {
    paragraph: string
    heading1: string
    heading2: string
    heading3: string
    bulletItem: string
    numberedItem: string
    checkItem: string
    quote: string
    codeBlock: string
    divider: string
  }
  /** Short descriptions in the slash menu. */
  hints: {
    paragraph: string
    heading1: string
    heading2: string
    heading3: string
    bulletItem: string
    numberedItem: string
    checkItem: string
    quote: string
    codeBlock: string
    divider: string
  }
  noResults: string
  addBlock: string
  dragHandle: string
  turnInto: string
  duplicate: string
  delete: string
  moveUp: string
  moveDown: string
  bold: string
  italic: string
  underline: string
  strike: string
  code: string
  link: string
  linkPlaceholder: string
  applyLink: string
  removeLink: string
  formatting: string
  /** The name of the slash menu's list. */
  blockTypes: string
}

const zhCN: EditorMessages = {
  placeholder: '输入 / 插入内容',
  emptyPlaceholder: '开始写点什么，或输入 / 插入内容',
  headingPlaceholder: '标题',
  types: {
    paragraph: '正文',
    heading1: '一级标题',
    heading2: '二级标题',
    heading3: '三级标题',
    bulletItem: '无序列表',
    numberedItem: '有序列表',
    checkItem: '待办事项',
    quote: '引用',
    codeBlock: '代码',
    divider: '分隔线',
  },
  hints: {
    paragraph: '普通的文字',
    heading1: '最大的标题',
    heading2: '中等的标题',
    heading3: '较小的标题',
    bulletItem: '用圆点列出几项',
    numberedItem: '按顺序编号',
    checkItem: '可以勾选的事项',
    quote: '引用一段话',
    codeBlock: '等宽显示代码',
    divider: '分隔上下内容',
  },
  noResults: '没有匹配的块',
  addBlock: '在下方添加块',
  dragHandle: '拖动以移动，点击打开菜单',
  turnInto: '转换为',
  duplicate: '复制',
  delete: '删除',
  moveUp: '上移',
  moveDown: '下移',
  bold: '粗体',
  italic: '斜体',
  underline: '下划线',
  strike: '删除线',
  code: '行内代码',
  link: '链接',
  linkPlaceholder: '粘贴或输入链接',
  applyLink: '确定',
  removeLink: '移除链接',
  formatting: '文字格式',
  blockTypes: '块类型',
}

const zhTW: EditorMessages = {
  placeholder: '輸入 / 插入內容',
  emptyPlaceholder: '開始寫點什麼，或輸入 / 插入內容',
  headingPlaceholder: '標題',
  types: {
    paragraph: '內文',
    heading1: '一級標題',
    heading2: '二級標題',
    heading3: '三級標題',
    bulletItem: '項目清單',
    numberedItem: '編號清單',
    checkItem: '待辦事項',
    quote: '引用',
    codeBlock: '程式碼',
    divider: '分隔線',
  },
  hints: {
    paragraph: '一般的文字',
    heading1: '最大的標題',
    heading2: '中等的標題',
    heading3: '較小的標題',
    bulletItem: '用圓點列出幾項',
    numberedItem: '依序編號',
    checkItem: '可以勾選的事項',
    quote: '引用一段話',
    codeBlock: '等寬顯示程式碼',
    divider: '分隔上下內容',
  },
  noResults: '沒有符合的區塊',
  addBlock: '在下方新增區塊',
  dragHandle: '拖曳以移動，點擊開啟選單',
  turnInto: '轉換為',
  duplicate: '複製',
  delete: '刪除',
  moveUp: '上移',
  moveDown: '下移',
  bold: '粗體',
  italic: '斜體',
  underline: '底線',
  strike: '刪除線',
  code: '行內程式碼',
  link: '連結',
  linkPlaceholder: '貼上或輸入連結',
  applyLink: '確定',
  removeLink: '移除連結',
  formatting: '文字格式',
  blockTypes: '區塊類型',
}

const en: EditorMessages = {
  placeholder: 'Type / for blocks',
  emptyPlaceholder: 'Start writing, or type / for blocks',
  headingPlaceholder: 'Heading',
  types: {
    paragraph: 'Text',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bulletItem: 'Bulleted list',
    numberedItem: 'Numbered list',
    checkItem: 'To-do',
    quote: 'Quote',
    codeBlock: 'Code',
    divider: 'Divider',
  },
  hints: {
    paragraph: 'Plain text',
    heading1: 'Large section heading',
    heading2: 'Medium section heading',
    heading3: 'Small section heading',
    bulletItem: 'A simple list',
    numberedItem: 'A list with numbers',
    checkItem: 'Items to tick off',
    quote: 'Quote someone',
    codeBlock: 'Code in a monospace font',
    divider: 'Separate sections',
  },
  noResults: 'No matching blocks',
  addBlock: 'Add a block below',
  dragHandle: 'Drag to move, click for the menu',
  turnInto: 'Turn into',
  duplicate: 'Duplicate',
  delete: 'Delete',
  moveUp: 'Move up',
  moveDown: 'Move down',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  code: 'Inline code',
  link: 'Link',
  linkPlaceholder: 'Paste or type a link',
  applyLink: 'Apply',
  removeLink: 'Remove link',
  formatting: 'Text formatting',
  blockTypes: 'Block types',
}

export const editorLocales: Record<string, EditorMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/**
 * The editor's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useEditorMessages(
  override?: MaybeRefOrGetter<Partial<EditorMessages> | undefined>,
) {
  const { locale } = useLocale()
  return computed<EditorMessages>(() => {
    const name = locale.value.name
    const base =
      editorLocales[name] ??
      editorLocales[name.split('-')[0]!] ??
      (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    return extra ? { ...base, ...extra } : base
  })
}
