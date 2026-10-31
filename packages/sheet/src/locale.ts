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
  /** Menu items. `{count}` is how many rows or columns. */
  cut: string
  copy: string
  paste: string
  insert: string
  delete: string
  insertRowsAbove: string
  insertRowsBelow: string
  insertColsLeft: string
  insertColsRight: string
  deleteRows: string
  deleteCols: string
  hideRows: string
  hideCols: string
  showRows: string
  showCols: string
  clear: string
  mergeCells: string
  unmergeCells: string
  merged: string
  /** Shown after merging cells that had values: `{range}`, `{count}` values cleared. */
  mergedCleared: string
  unmerged: string
  /** Read out after copying or cutting: `{range}`. */
  copied: string
  cutDone: string
  /** Read out after pasting or filling: `{range}`. */
  pasted: string
  filled: string
  /** Read out after rows or columns change: `{count}`. */
  rowsInserted: string
  colsInserted: string
  rowsDeleted: string
  colsDeleted: string
  rowsMoved: string
  colsMoved: string
  /** Read out after resizing: `{size}` in px. */
  resized: string
  /** Shown when the browser won't let the page read the clipboard: `{key}` pastes instead. */
  pasteBlocked: string
  /** The handle at the corner of the selection, for filling. */
  fillHandle: string
  /** How a check box cell reads. */
  checked: string
  unchecked: string
  /** The button on a cell with a list or calendar, which opens it. */
  openPanel: string
  /** The list of a `select` cell, and what it shows when nothing matches. */
  options: string
  noOptions: string
  /** Why a value doesn't fit its cell's type, shown on hover and read out. */
  invalid: string
  notDate: string
  notOption: string
  notChecked: string
  /** The name a new sheet gets: `{n}` is a number. */
  sheetName: string
  /** The sheet tabs' accessible name. */
  sheets: string
  /** Read out when another sheet shows: `{name}`. */
  sheetShown: string
  addSheet: string
  renameSheet: string
  duplicateSheet: string
  deleteSheet: string
  moveSheetLeft: string
  moveSheetRight: string
  /** Read out after a sheet is added: `{name}`. */
  sheetAdded: string
  /** Read out after a sheet is deleted: `{name}`. */
  sheetDeleted: string
  /** Read out after a sheet moves: `{name}`, now `{index}` of `{count}`. */
  sheetMoved: string
  /** Shown when a new name is taken: `{name}`. */
  sheetNameTaken: string
  sheetNameEmpty: string
  /** How to use the tabs with keys; read out when they get focus. */
  sheetTabKeys: string

  /** The toolbar's name. */
  toolbar: string
  undo: string
  redo: string
  bold: string
  italic: string
  underline: string
  strike: string
  /** Read out after a style is turned on or off with its key: `{name}`. */
  styleOn: string
  styleOff: string
  clearFormatting: string
  formattingCleared: string
  /** The number format menu and its items; `formatCurrency` is the currency's format. */
  numberFormat: string
  formatGeneral: string
  formatNumber: string
  formatPercent: string
  formatCurrency: string
  currencyFormat: string
  formatDate: string
  formatTime: string
  formatText: string
  formatCustom: string
  moreDecimals: string
  fewerDecimals: string
  textColor: string
  fillColor: string
  /** The color a style leaves to the sheet. */
  colorDefault: string
  colorCustom: string
  toneNeutral: string
  tonePrimary: string
  toneSuccess: string
  toneWarning: string
  toneDanger: string
  alignLeft: string
  alignCenter: string
  alignRight: string
  verticalAlign: string
  alignTop: string
  alignMiddle: string
  alignBottom: string
  wrap: string
  freeze: string
  /** Freezes the rows (or columns) up to the active cell's: `{n}` rows, up to column `{col}`. */
  freezeRows: string
  freezeCols: string
  freezeFirstRow: string
  freezeFirstCol: string
  unfreeze: string
}

const zhCN: SheetMessages = {
  sheet: '电子表格',
  selectAll: '全选',
  cell: '{cell}，{value}',
  empty: '空',
  selected: '已选择 {range}，共 {count} 个单元格',
  edit: '编辑 {cell}',
  keys: '方向键移动，Shift 加方向键扩大选区，输入内容或按 F2 编辑，Enter 确认，Esc 取消，Delete 清空。勾选框按空格切换，Alt 加下方向键展开选项。',
  readonly: '表格是只读的',
  cleared: '已清空 {range}',
  changed: '{cell} 改为 {value}',
  undone: '已撤销',
  redone: '已重做',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  insert: '插入',
  delete: '删除',
  insertRowsAbove: '在上方插入 {count} 行',
  insertRowsBelow: '在下方插入 {count} 行',
  insertColsLeft: '在左侧插入 {count} 列',
  insertColsRight: '在右侧插入 {count} 列',
  deleteRows: '删除 {count} 行',
  deleteCols: '删除 {count} 列',
  hideRows: '隐藏 {count} 行',
  hideCols: '隐藏 {count} 列',
  showRows: '取消隐藏行',
  showCols: '取消隐藏列',
  clear: '清除内容',
  mergeCells: '合并单元格',
  unmergeCells: '取消合并',
  merged: '已合并 {range}',
  mergedCleared: '已合并 {range}，只保留左上角的内容，清空了 {count} 个单元格，可以撤销',
  unmerged: '已取消合并 {range}',
  copied: '已复制 {range}',
  cutDone: '已剪切 {range}',
  pasted: '已粘贴到 {range}',
  filled: '已填充 {range}',
  rowsInserted: '已插入 {count} 行',
  colsInserted: '已插入 {count} 列',
  rowsDeleted: '已删除 {count} 行',
  colsDeleted: '已删除 {count} 列',
  rowsMoved: '已移动 {count} 行',
  colsMoved: '已移动 {count} 列',
  resized: '已改为 {size} 像素',
  pasteBlocked: '浏览器不允许网页读取剪贴板，请按 {key} 粘贴',
  fillHandle: '填充柄',
  checked: '已勾选',
  unchecked: '未勾选',
  openPanel: '展开选项',
  options: '选项',
  noOptions: '没有匹配的选项',
  invalid: '不符合单元格类型',
  notDate: '不是日期',
  notOption: '不在选项里',
  notChecked: '不是勾选值',
  sheetName: '工作表{n}',
  sheets: '工作表',
  sheetShown: '工作表“{name}”',
  addSheet: '新建工作表',
  renameSheet: '重命名',
  duplicateSheet: '创建副本',
  deleteSheet: '删除',
  moveSheetLeft: '向左移动',
  moveSheetRight: '向右移动',
  sheetAdded: '已新建工作表“{name}”',
  sheetDeleted: '已删除工作表“{name}”',
  sheetMoved: '“{name}”移到第 {index} 个，共 {count} 个',
  sheetNameTaken: '已有名为“{name}”的工作表',
  sheetNameEmpty: '名称不能为空',
  sheetTabKeys: '左右方向键切换工作表，F2 重命名，Shift + F10 打开菜单',
  toolbar: '格式',
  undo: '撤销',
  redo: '重做',
  bold: '加粗',
  italic: '斜体',
  underline: '下划线',
  strike: '删除线',
  styleOn: '{name}：开',
  styleOff: '{name}：关',
  clearFormatting: '清除格式',
  formattingCleared: '已清除格式',
  numberFormat: '数字格式',
  formatGeneral: '常规',
  formatNumber: '数字',
  formatPercent: '百分比',
  formatCurrency: '货币',
  currencyFormat: '¥#,##0.00',
  formatDate: '日期',
  formatTime: '时间',
  formatText: '文本',
  formatCustom: '自定义',
  moreDecimals: '增加小数位数',
  fewerDecimals: '减少小数位数',
  textColor: '文字颜色',
  fillColor: '填充颜色',
  colorDefault: '默认',
  colorCustom: '自定义颜色',
  toneNeutral: '中性',
  tonePrimary: '主色',
  toneSuccess: '成功',
  toneWarning: '警告',
  toneDanger: '危险',
  alignLeft: '左对齐',
  alignCenter: '居中对齐',
  alignRight: '右对齐',
  verticalAlign: '垂直对齐',
  alignTop: '顶端对齐',
  alignMiddle: '中部对齐',
  alignBottom: '底端对齐',
  wrap: '自动换行',
  freeze: '冻结',
  freezeRows: '冻结到第 {n} 行',
  freezeCols: '冻结到 {col} 列',
  freezeFirstRow: '冻结首行',
  freezeFirstCol: '冻结首列',
  unfreeze: '取消冻结',
}

const zhTW: SheetMessages = {
  sheet: '試算表',
  selectAll: '全選',
  cell: '{cell}，{value}',
  empty: '空白',
  selected: '已選取 {range}，共 {count} 個儲存格',
  edit: '編輯 {cell}',
  keys: '方向鍵移動，Shift 加方向鍵擴大選取範圍，輸入內容或按 F2 編輯，Enter 確認，Esc 取消，Delete 清除。勾選框按空白鍵切換，Alt 加下方向鍵展開選項。',
  readonly: '試算表是唯讀的',
  cleared: '已清除 {range}',
  changed: '{cell} 改為 {value}',
  undone: '已復原',
  redone: '已重做',
  cut: '剪下',
  copy: '複製',
  paste: '貼上',
  insert: '插入',
  delete: '刪除',
  insertRowsAbove: '在上方插入 {count} 列',
  insertRowsBelow: '在下方插入 {count} 列',
  insertColsLeft: '在左側插入 {count} 欄',
  insertColsRight: '在右側插入 {count} 欄',
  deleteRows: '刪除 {count} 列',
  deleteCols: '刪除 {count} 欄',
  hideRows: '隱藏 {count} 列',
  hideCols: '隱藏 {count} 欄',
  showRows: '取消隱藏列',
  showCols: '取消隱藏欄',
  clear: '清除內容',
  mergeCells: '合併儲存格',
  unmergeCells: '取消合併',
  merged: '已合併 {range}',
  mergedCleared: '已合併 {range}，只保留左上角的內容，清除了 {count} 個儲存格，可以復原',
  unmerged: '已取消合併 {range}',
  copied: '已複製 {range}',
  cutDone: '已剪下 {range}',
  pasted: '已貼上到 {range}',
  filled: '已填滿 {range}',
  rowsInserted: '已插入 {count} 列',
  colsInserted: '已插入 {count} 欄',
  rowsDeleted: '已刪除 {count} 列',
  colsDeleted: '已刪除 {count} 欄',
  rowsMoved: '已移動 {count} 列',
  colsMoved: '已移動 {count} 欄',
  resized: '已改為 {size} 像素',
  pasteBlocked: '瀏覽器不允許網頁讀取剪貼簿，請按 {key} 貼上',
  fillHandle: '填滿控點',
  checked: '已勾選',
  unchecked: '未勾選',
  openPanel: '展開選項',
  options: '選項',
  noOptions: '沒有符合的選項',
  invalid: '不符合儲存格類型',
  notDate: '不是日期',
  notOption: '不在選項裡',
  notChecked: '不是勾選值',
  sheetName: '工作表{n}',
  sheets: '工作表',
  sheetShown: '工作表「{name}」',
  addSheet: '新增工作表',
  renameSheet: '重新命名',
  duplicateSheet: '建立副本',
  deleteSheet: '刪除',
  moveSheetLeft: '向左移動',
  moveSheetRight: '向右移動',
  sheetAdded: '已新增工作表「{name}」',
  sheetDeleted: '已刪除工作表「{name}」',
  sheetMoved: '「{name}」移到第 {index} 個，共 {count} 個',
  sheetNameTaken: '已有名為「{name}」的工作表',
  sheetNameEmpty: '名稱不能為空',
  sheetTabKeys: '左右方向鍵切換工作表，F2 重新命名，Shift + F10 開啟選單',
  toolbar: '格式',
  undo: '復原',
  redo: '重做',
  bold: '粗體',
  italic: '斜體',
  underline: '底線',
  strike: '刪除線',
  styleOn: '{name}：開',
  styleOff: '{name}：關',
  clearFormatting: '清除格式',
  formattingCleared: '已清除格式',
  numberFormat: '數字格式',
  formatGeneral: '一般',
  formatNumber: '數字',
  formatPercent: '百分比',
  formatCurrency: '貨幣',
  currencyFormat: '$#,##0.00',
  formatDate: '日期',
  formatTime: '時間',
  formatText: '文字',
  formatCustom: '自訂',
  moreDecimals: '增加小數位數',
  fewerDecimals: '減少小數位數',
  textColor: '文字顏色',
  fillColor: '填滿色彩',
  colorDefault: '預設',
  colorCustom: '自訂顏色',
  toneNeutral: '中性',
  tonePrimary: '主色',
  toneSuccess: '成功',
  toneWarning: '警告',
  toneDanger: '危險',
  alignLeft: '靠左對齊',
  alignCenter: '置中對齊',
  alignRight: '靠右對齊',
  verticalAlign: '垂直對齊',
  alignTop: '靠上對齊',
  alignMiddle: '中間對齊',
  alignBottom: '靠下對齊',
  wrap: '自動換行',
  freeze: '凍結',
  freezeRows: '凍結至第 {n} 列',
  freezeCols: '凍結至 {col} 欄',
  freezeFirstRow: '凍結首列',
  freezeFirstCol: '凍結首欄',
  unfreeze: '取消凍結',
}

const en: SheetMessages = {
  sheet: 'Spreadsheet',
  selectAll: 'Select all',
  cell: '{cell}, {value}',
  empty: 'empty',
  selected: '{range} selected, {count} cells',
  edit: 'Edit {cell}',
  keys: 'Arrow keys move, Shift and an arrow extend the selection, type or press F2 to edit, Enter to confirm, Escape to cancel, Delete to clear. Space switches a check box, Alt and Down show the options of a cell.',
  readonly: 'The spreadsheet is read-only',
  cleared: '{range} cleared',
  changed: '{cell} is now {value}',
  undone: 'Undone',
  redone: 'Redone',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  insert: 'Insert',
  delete: 'Delete',
  insertRowsAbove: 'Insert {count} rows above',
  insertRowsBelow: 'Insert {count} rows below',
  insertColsLeft: 'Insert {count} columns left',
  insertColsRight: 'Insert {count} columns right',
  deleteRows: 'Delete {count} rows',
  deleteCols: 'Delete {count} columns',
  hideRows: 'Hide {count} rows',
  hideCols: 'Hide {count} columns',
  showRows: 'Unhide rows',
  showCols: 'Unhide columns',
  clear: 'Clear contents',
  mergeCells: 'Merge cells',
  unmergeCells: 'Unmerge',
  merged: '{range} merged',
  mergedCleared:
    'Merged {range}. Only the top left value is kept; {count} cleared. Undo to restore them.',
  unmerged: '{range} unmerged',
  copied: '{range} copied',
  cutDone: '{range} cut',
  pasted: 'Pasted into {range}',
  filled: '{range} filled',
  rowsInserted: '{count} rows inserted',
  colsInserted: '{count} columns inserted',
  rowsDeleted: '{count} rows deleted',
  colsDeleted: '{count} columns deleted',
  rowsMoved: '{count} rows moved',
  colsMoved: '{count} columns moved',
  resized: 'Resized to {size} px',
  pasteBlocked: "The browser doesn't let the page read the clipboard. Press {key} to paste.",
  fillHandle: 'Fill handle',
  checked: 'Checked',
  unchecked: 'Not checked',
  openPanel: 'Show options',
  options: 'Options',
  noOptions: 'No matching options',
  invalid: "Doesn't fit the cell type",
  notDate: 'Not a date',
  notOption: 'Not one of the options',
  notChecked: 'Not checked or unchecked',
  sheetName: 'Sheet{n}',
  sheets: 'Sheets',
  sheetShown: 'Sheet “{name}”',
  addSheet: 'Add sheet',
  renameSheet: 'Rename',
  duplicateSheet: 'Duplicate',
  deleteSheet: 'Delete',
  moveSheetLeft: 'Move left',
  moveSheetRight: 'Move right',
  sheetAdded: 'Added sheet “{name}”',
  sheetDeleted: 'Deleted sheet “{name}”',
  sheetMoved: '“{name}” moved to {index} of {count}',
  sheetNameTaken: 'There is a sheet named “{name}” already',
  sheetNameEmpty: "The name can't be empty",
  sheetTabKeys: 'Left and right arrows switch sheets, F2 renames, Shift + F10 opens the menu',
  toolbar: 'Formatting',
  undo: 'Undo',
  redo: 'Redo',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  styleOn: '{name} on',
  styleOff: '{name} off',
  clearFormatting: 'Clear formatting',
  formattingCleared: 'Formatting cleared',
  numberFormat: 'Number format',
  formatGeneral: 'General',
  formatNumber: 'Number',
  formatPercent: 'Percent',
  formatCurrency: 'Currency',
  currencyFormat: '$#,##0.00',
  formatDate: 'Date',
  formatTime: 'Time',
  formatText: 'Text',
  formatCustom: 'Custom',
  moreDecimals: 'More decimal places',
  fewerDecimals: 'Fewer decimal places',
  textColor: 'Text color',
  fillColor: 'Fill color',
  colorDefault: 'Default',
  colorCustom: 'Custom color',
  toneNeutral: 'Neutral',
  tonePrimary: 'Primary',
  toneSuccess: 'Success',
  toneWarning: 'Warning',
  toneDanger: 'Danger',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  verticalAlign: 'Vertical align',
  alignTop: 'Align top',
  alignMiddle: 'Align middle',
  alignBottom: 'Align bottom',
  wrap: 'Wrap text',
  freeze: 'Freeze',
  freezeRows: 'Up to row {n}',
  freezeCols: 'Up to column {col}',
  freezeFirstRow: 'First row',
  freezeFirstCol: 'First column',
  unfreeze: 'Unfreeze',
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
