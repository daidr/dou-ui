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
    image: string
    toggle: string
    callout: string
    table: string
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
    image: string
    toggle: string
    callout: string
    table: string
  }
  /** The image block. */
  image: {
    empty: string
    upload: string
    embed: string
    urlPlaceholder: string
    apply: string
    uploading: string
    failed: string
    caption: string
    resize: string
  }
  /** The code block. */
  codeBlock: {
    /** The language picker's name. */
    language: string
    plainText: string
  }
  toggle: { expand: string; collapse: string }
  callout: {
    /** Said after the tone on the icon button. */
    change: string
    tones: { info: string; tip: string; warning: string; danger: string }
  }
  mention: { label: string; searching: string; noResults: string }
  /** The table: its row and column menus. */
  table: {
    row: string
    column: string
    insertAbove: string
    insertBelow: string
    insertLeft: string
    insertRight: string
    moveUp: string
    moveDown: string
    moveLeft: string
    moveRight: string
    deleteRow: string
    deleteColumn: string
    merge: string
    split: string
    clear: string
    headerRow: string
    headerColumn: string
    alignLeft: string
    alignCenter: string
    alignRight: string
    addRow: string
    addColumn: string
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
  /** Starts a comment thread on the selected text. */
  comment: string
  /** The name of the card that shows a thread. */
  commentThread: string
  /** Shown for a removed block that has no text, such as a divider, when comparing versions. */
  removedBlock: string
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
    image: '图片',
    toggle: '折叠块',
    callout: '提示块',
    table: '表格',
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
    image: '上传或嵌入一张图片',
    toggle: '可以展开和收起的内容',
    callout: '带图标的醒目说明',
    table: '插入一个表格',
  },
  image: {
    empty: '添加一张图片',
    upload: '上传',
    embed: '嵌入链接',
    urlPlaceholder: '粘贴图片链接',
    apply: '确定',
    uploading: '正在上传',
    failed: '上传失败，请重试',
    caption: '添加说明',
    resize: '拖动调整宽度',
  },
  codeBlock: { language: '语言', plainText: '纯文本' },
  toggle: { expand: '展开', collapse: '收起' },
  mention: { label: '提及', searching: '正在搜索', noResults: '没有找到' },
  table: {
    row: '选择这一行',
    column: '选择这一列',
    insertAbove: '在上方插入行',
    insertBelow: '在下方插入行',
    insertLeft: '在左侧插入列',
    insertRight: '在右侧插入列',
    moveUp: '上移',
    moveDown: '下移',
    moveLeft: '左移',
    moveRight: '右移',
    deleteRow: '删除行',
    deleteColumn: '删除列',
    merge: '合并单元格',
    split: '取消合并',
    clear: '清空内容',
    headerRow: '标题行',
    headerColumn: '标题列',
    alignLeft: '左对齐',
    alignCenter: '居中',
    alignRight: '右对齐',
    addRow: '添加一行',
    addColumn: '添加一列',
  },
  callout: {
    change: '点击更换',
    tones: { info: '说明', tip: '提示', warning: '注意', danger: '警告' },
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
  comment: '评论',
  commentThread: '评论',
  removedBlock: '已删除的内容',
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
    image: '圖片',
    toggle: '摺疊區塊',
    callout: '提示區塊',
    table: '表格',
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
    image: '上傳或嵌入一張圖片',
    toggle: '可以展開和收合的內容',
    callout: '帶圖示的醒目說明',
    table: '插入一個表格',
  },
  image: {
    empty: '新增一張圖片',
    upload: '上傳',
    embed: '嵌入連結',
    urlPlaceholder: '貼上圖片連結',
    apply: '確定',
    uploading: '正在上傳',
    failed: '上傳失敗，請重試',
    caption: '新增說明',
    resize: '拖曳調整寬度',
  },
  codeBlock: { language: '語言', plainText: '純文字' },
  toggle: { expand: '展開', collapse: '收合' },
  mention: { label: '提及', searching: '正在搜尋', noResults: '沒有找到' },
  table: {
    row: '選擇這一列',
    column: '選擇這一欄',
    insertAbove: '在上方插入列',
    insertBelow: '在下方插入列',
    insertLeft: '在左側插入欄',
    insertRight: '在右側插入欄',
    moveUp: '上移',
    moveDown: '下移',
    moveLeft: '左移',
    moveRight: '右移',
    deleteRow: '刪除列',
    deleteColumn: '刪除欄',
    merge: '合併儲存格',
    split: '取消合併',
    clear: '清除內容',
    headerRow: '標題列',
    headerColumn: '標題欄',
    alignLeft: '靠左對齊',
    alignCenter: '置中',
    alignRight: '靠右對齊',
    addRow: '新增一列',
    addColumn: '新增一欄',
  },
  callout: {
    change: '點擊更換',
    tones: { info: '說明', tip: '提示', warning: '注意', danger: '警告' },
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
  comment: '評論',
  commentThread: '評論',
  removedBlock: '已刪除的內容',
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
    image: 'Image',
    toggle: 'Toggle',
    callout: 'Callout',
    table: 'Table',
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
    image: 'Upload or embed an image',
    toggle: 'Content that can be shown or hidden',
    callout: 'A note that stands out, with an icon',
    table: 'A grid of rows and columns',
  },
  image: {
    empty: 'Add an image',
    upload: 'Upload',
    embed: 'Embed link',
    urlPlaceholder: 'Paste the image link',
    apply: 'Apply',
    uploading: 'Uploading',
    failed: 'Upload failed, try again',
    caption: 'Add a caption',
    resize: 'Drag to resize',
  },
  codeBlock: { language: 'Language', plainText: 'Plain text' },
  toggle: { expand: 'Expand', collapse: 'Collapse' },
  mention: { label: 'Mention', searching: 'Searching', noResults: 'No one found' },
  table: {
    row: 'Select row',
    column: 'Select column',
    insertAbove: 'Insert row above',
    insertBelow: 'Insert row below',
    insertLeft: 'Insert column left',
    insertRight: 'Insert column right',
    moveUp: 'Move up',
    moveDown: 'Move down',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    deleteRow: 'Delete row',
    deleteColumn: 'Delete column',
    merge: 'Merge cells',
    split: 'Unmerge',
    clear: 'Clear contents',
    headerRow: 'Header row',
    headerColumn: 'Header column',
    alignLeft: 'Align left',
    alignCenter: 'Align center',
    alignRight: 'Align right',
    addRow: 'Add a row',
    addColumn: 'Add a column',
  },
  callout: {
    change: 'click to change',
    tones: { info: 'Info', tip: 'Tip', warning: 'Warning', danger: 'Danger' },
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
  comment: 'Comment',
  commentThread: 'Comments',
  removedBlock: 'Removed content',
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
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** Any part of the messages: a nested group can be given in part too. */
export type EditorMessagesOverride = DeepPartial<EditorMessages>

function merge<T>(base: T, extra: unknown): T {
  if (!extra || typeof extra !== 'object') return (extra ?? base) as T
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue
    const current = result[key]
    result[key] =
      current && typeof current === 'object' && typeof value === 'object'
        ? merge(current, value)
        : value
  }
  return result as T
}

export function useEditorMessages(override?: MaybeRefOrGetter<EditorMessagesOverride | undefined>) {
  const { locale } = useLocale()
  return computed<EditorMessages>(() => {
    const name = locale.value.name
    const base =
      editorLocales[name] ??
      editorLocales[name.split('-')[0]!] ??
      (name.startsWith('zh') ? zhCN : en)
    const extra = toValue(override)
    return extra ? merge(base, extra) : base
  })
}
