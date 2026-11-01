/** The texts of reading .xlsx files: what couldn't be brought over, and why a file couldn't be read. */
export interface SheetXlsxMessages {
  /** What a file had that the sheet can't hold, by warning code. */
  warnings: Record<SheetXlsxWarningCode, string>
  /** Why a file couldn't be read, shown in the sheet's hint. */
  notXlsx: string
  damaged: string
  locked: string
}

/** What `readXlsx` couldn't bring over, as the `code` of its warnings. */
export type SheetXlsxWarningCode =
  | 'border'
  | 'font'
  | 'richText'
  | 'image'
  | 'chart'
  | 'pivot'
  | 'macro'
  | 'hyperlink'
  | 'hiddenSheet'
  | 'external'
  | 'name'
  | 'conditional'
  | 'validation'
  | 'filter'

const zhCN: SheetXlsxMessages = {
  warnings: {
    border: '边框',
    font: '字号',
    richText: '单元格里部分文字的格式',
    image: '图片和形状',
    chart: '图表',
    pivot: '数据透视表',
    macro: '宏',
    hyperlink: '超链接',
    hiddenSheet: '隐藏的工作表，已显示出来',
    external: '引用其他文件的公式，已换成计算结果',
    name: '定义的名称，用到它们的公式会出错',
    conditional: '无法对应的条件格式',
    validation: '无法对应的数据验证',
    filter: '无法对应的筛选条件',
  },
  notXlsx: '这不是 .xlsx 文件',
  damaged: '文件已损坏',
  locked: '文件设了密码，请先在原来的软件里取消密码',
}

const zhTW: SheetXlsxMessages = {
  warnings: {
    border: '框線',
    font: '字級',
    richText: '儲存格裡部分文字的格式',
    image: '圖片和圖形',
    chart: '圖表',
    pivot: '樞紐分析表',
    macro: '巨集',
    hyperlink: '超連結',
    hiddenSheet: '隱藏的工作表，已顯示出來',
    external: '參照其他檔案的公式，已換成計算結果',
    name: '定義的名稱，用到它們的公式會出錯',
    conditional: '無法對應的設定格式化條件',
    validation: '無法對應的資料驗證',
    filter: '無法對應的篩選條件',
  },
  notXlsx: '這不是 .xlsx 檔案',
  damaged: '檔案已損毀',
  locked: '檔案設了密碼，請先在原來的軟體裡取消密碼',
}

const en: SheetXlsxMessages = {
  warnings: {
    border: 'Borders',
    font: 'Font sizes',
    richText: 'Formatting of part of the text in a cell',
    image: 'Pictures and shapes',
    chart: 'Charts',
    pivot: 'Pivot tables',
    macro: 'Macros',
    hyperlink: 'Hyperlinks',
    hiddenSheet: 'Hidden sheets, now shown',
    external: 'Formulas that refer to other files, kept as their results',
    name: 'Defined names; formulas that use them show an error',
    conditional: "Conditional formats the sheet doesn't have",
    validation: "Data validations the sheet doesn't have",
    filter: "Filter conditions the sheet doesn't have",
  },
  notXlsx: "This isn't an .xlsx file",
  damaged: 'The file is damaged',
  locked: 'The file has a password; remove it in the program it came from first',
}

export const sheetXlsxLocales: Record<string, SheetXlsxMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/** The texts for a language, such as `zh-CN`; Chinese or English by its first part, English otherwise. */
export function sheetXlsxMessagesFor(locale = 'zh-CN'): SheetXlsxMessages {
  return (
    sheetXlsxLocales[locale] ??
    sheetXlsxLocales[locale.split('-')[0]!] ??
    (locale.startsWith('zh') ? zhCN : en)
  )
}
