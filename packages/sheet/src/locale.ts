import type { SheetCondition } from './core/model'
import type { SheetProtectionRefusal } from './core/protect'
import type { SheetErrorCode } from './formula/error'
import { helpEn, helpZhCN, helpZhTW, type SheetFunctionHelp } from './formula/help'

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
  /** Said when an extension cancels a change without saying why. */
  changeCancelled: string
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
  /** Why a formula gives an error value, shown on hover and read out. */
  errors: Record<SheetErrorCode, string>
  /** What the built-in functions take and do, by name, for completion and argument hints. */
  functions: Record<string, SheetFunctionHelp>
  /** The formula bar: the box with the cell's address, and the formula box. */
  nameBox: string
  formulaBox: string
  /** An address typed in the name box that isn't one: `{text}` is what was typed. */
  badAddress: string
  /** The formula bar's code input: text that isn't a formula. */
  formulaSyntax: string
  unknownFunction: string
  /** The list of functions while typing a function's name. */
  functionList: string
  /** Sorting and filtering. */
  /** The conditions of filters and conditional formats. */
  ops: Record<SheetCondition['op'], string>
  group: SheetGroupMessages
  note: SheetNoteMessages
  /** Cell links: the menu items, the card under a linked cell and the box that edits it. */
  link: SheetLinkMessages
  /** Protecting sheets and the workbook, and why a change to them isn't allowed. */
  protect: SheetProtectMessages
  filter: SheetFilterMessages
  /** Conditional formats: the toolbar's menu, the dialog that adds one and the list of them. */
  formats: SheetFormatsMessages
  validation: SheetValidationMessages
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
  print: string
  /** Files in and out: the export and import menus, and what is read out after. */
  file: SheetFileMessages
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
  changeCancelled: '这次修改没有生效',
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
  errors: {
    '#DIV/0!': '除以 0',
    '#N/A': '没有找到',
    '#NAME?': '没有这个函数',
    '#NULL!': '区域没有交集',
    '#NUM!': '数字超出范围',
    '#REF!': '引用的单元格或工作表不存在',
    '#VALUE!': '值的类型不对',
    '#CYCLE!': '公式引用了自己',
    '#ERROR!': '公式写法有误',
  },
  functions: helpZhCN,
  nameBox: '单元格地址',
  formulaBox: '编辑栏',
  badAddress: '“{text}”不是单元格地址',
  formulaSyntax: '公式写得不完整或有误',
  unknownFunction: '没有名为 {name} 的函数',
  functionList: '函数',
  ops: {
    eq: '等于',
    ne: '不等于',
    gt: '大于',
    ge: '大于或等于',
    lt: '小于',
    le: '小于或等于',
    between: '介于',
    notBetween: '不介于',
    contains: '包含',
    notContains: '不包含',
    begins: '开头是',
    ends: '结尾是',
    blank: '为空',
    notBlank: '不为空',
  },
  formats: {
    title: '条件格式',
    highlight: '突出显示单元格',
    ranks: '最前 / 最后',
    gt: '大于…',
    lt: '小于…',
    between: '介于…',
    eq: '等于…',
    contains: '文本包含…',
    duplicates: '重复值…',
    formula: '使用公式…',
    top: '前 10 项…',
    bottom: '后 10 项…',
    above: '高于平均值…',
    below: '低于平均值…',
    bar: '数据条',
    scale: '色阶',
    clearSelection: '清除所选单元格的规则',
    clearSheet: '清除此工作表的规则',
    manage: '管理规则…',
    range: '应用于',
    value: '值',
    and: '到',
    count: '项数',
    percent: '按百分比',
    repeated: '重复',
    unique: '唯一',
    look: '设置为',
    invalidRange: '请输入单元格区域，如 D2:D40',
    needValue: '请输入值',
    cancel: '取消',
    apply: '确定',
    close: '关闭',
    edit: '编辑',
    editTitle: '编辑规则',
    condition: '条件',
    formulaField: '公式',
    formulaHelp: '按区域左上角的单元格书写，如 =$D2>$C2',
    needFormula: '请输入公式',
    color: '颜色',
    current: '保持原样',
    looks: {
      danger: '浅红填充，深红色文字',
      warning: '浅黄填充，深黄色文字',
      success: '浅绿填充，深绿色文字',
      dangerText: '红色文字',
      bold: '加粗',
      neutral: '浅灰填充',
    },
    scales: {
      rag: '红 - 黄 - 绿',
      gar: '绿 - 黄 - 红',
      diverging: '红 - 灰 - 绿',
      blue: '灰 - 蓝',
    },
    describe: {
      when: '单元格值{op} {value}',
      between: '单元格值{op} {value} 和 {to} 之间',
      formula: '公式 {formula}',
      top: '前 {count} 项',
      topPercent: '前 {count}%',
      bottom: '后 {count} 项',
      bottomPercent: '后 {count}%',
      above: '高于平均值',
      below: '低于平均值',
      repeated: '重复值',
      unique: '唯一值',
      scale: '色阶',
      bar: '数据条',
    },
    empty: '此工作表没有条件格式',
    moveUp: '上移',
    moveDown: '下移',
    remove: '删除',
    added: '已为 {range} 添加条件格式',
    cleared: '已清除 {count} 条条件格式',
  },
  validation: {
    title: '数据验证',
    range: '应用于',
    allow: '允许',
    kinds: { list: '列表', number: '数字', integer: '整数', text: '文本', formula: '公式' },
    condition: '条件',
    any: '任意值',
    value: '值',
    and: '到',
    options: '选项',
    optionsHelp: '用逗号分隔，或引用单元格，如 =$H$2:$H$9',
    formula: '公式',
    formulaHelp: '按区域左上角的单元格书写，结果为 TRUE 时符合',
    prompt: '输入提示',
    promptHelp: '选中单元格时显示，选填',
    message: '出错提示',
    messageHelp: '选填，不填时说明规则',
    strict: '拒绝不符合的输入',
    strictHelp: '不勾选时保留输入的值，在单元格角上标记',
    invalidRange: '请输入单元格区域，如 D2:D40',
    needValue: '请输入值',
    needOptions: '请输入选项',
    needFormula: '请输入公式',
    remove: '删除规则',
    cancel: '取消',
    apply: '确定',
    list: '请从列表中选择',
    number: '请输入数字，{cond}',
    numberOnly: '请输入数字',
    integer: '请输入整数，{cond}',
    integerOnly: '请输入整数',
    text: '值应{cond}',
    formulaFailed: '不符合规则 {formula}',
    cond: '{op} {value}',
    condBetween: '{op} {value} 和 {to} 之间',
    refused: '没有写入：{message}',
    added: '已为 {range} 设置数据验证',
    removed: '已删除 {range} 的数据验证',
  },
  group: {
    group: '分组',
    groupRows: '将 {count} 行分组',
    groupCols: '将 {count} 列分组',
    ungroupRows: '取消行分组',
    ungroupCols: '取消列分组',
    rowLines: '第 {from}–{to} 行',
    rowLine: '第 {from} 行',
    colLines: '{from}–{to} 列',
    colLine: '{from} 列',
    collapseRows: '折叠{lines}',
    expandRows: '展开{lines}',
    collapseCols: '折叠 {lines}',
    expandCols: '展开 {lines}',
    collapsedRows: '已折叠{lines}',
    expandedRows: '已展开{lines}',
    collapsedCols: '已折叠 {lines}',
    expandedCols: '已展开 {lines}',
    rowLevel: '行分组显示到第 {level} 级',
    colLevel: '列分组显示到第 {level} 级',
    levelShown: '已显示到第 {level} 级',
    groupedRows: '已将 {count} 行分组',
    groupedCols: '已将 {count} 列分组',
    ungrouped: '已取消分组',
    crossing: '不能这样分组：会和分组“{group}”交叉',
    tooDeep: '不能这样分组：分组最多嵌套 8 层',
  },
  note: {
    add: '插入批注',
    edit: '编辑批注',
    remove: '删除批注',
    removeMany: '删除 {count} 条批注',
    label: '批注',
    cellNote: '批注：{note}',
    placeholder: '写下批注',
    save: '保存',
    cancel: '取消',
    saved: '已保存批注',
    removed: '已删除批注',
    removedMany: '已删除 {count} 条批注',
  },
  link: {
    add: '插入链接',
    edit: '编辑链接',
    remove: '删除链接',
    open: '打开链接',
    label: '链接',
    cellLink: '链接：{link}',
    text: '文本',
    address: '链接地址',
    addressPlaceholder: '网址，或 #A1 跳到表格里的单元格',
    badAddress: '只支持 http、https、mailto、tel 开头的地址，或 # 开头的单元格引用',
    save: '保存',
    cancel: '取消',
    saved: '已保存链接',
    removed: '已删除链接',
    jumped: '已跳到 {cell}',
    missing: '找不到链接指向的位置：{link}',
  },
  protect: {
    menu: '保护',
    protectSheet: '保护工作表',
    unprotectSheet: '取消保护工作表',
    protectBook: '保护工作簿结构',
    unprotectBook: '取消保护工作簿结构',
    lock: '锁定单元格',
    unlock: '取消锁定单元格',
    sheetProtected: '已保护工作表 {name}',
    sheetUnprotected: '已取消保护工作表 {name}',
    bookProtected: '已保护工作簿结构',
    bookUnprotected: '已取消保护工作簿结构',
    locked: '已锁定所选单元格',
    unlocked: '已取消锁定所选单元格',
    protectedSheet: '（受保护）',
    refused: {
      cell: '单元格受保护，不能修改',
      format: '受保护的工作表不能修改锁定单元格的格式',
      lock: '工作表受保护时不能锁定或解锁单元格',
      formatRows: '受保护的工作表不能调整行高或隐藏行',
      formatColumns: '受保护的工作表不能调整列宽或隐藏列',
      insertRows: '受保护的工作表不能插入行',
      insertColumns: '受保护的工作表不能插入列',
      deleteRows: '受保护的工作表不能删除行',
      deleteColumns: '受保护的工作表不能删除列',
      filter: '受保护的工作表不能筛选',
      sheet: '工作表受保护，不能修改',
      structure: '工作簿结构受保护，不能添加、删除、移动或重命名工作表',
    },
  },
  filter: {
    sortAsc: '升序排序',
    sortDesc: '降序排序',
    sort: '排序',
    turnOn: '筛选',
    turnOff: '取消筛选',
    clearAll: '清除所有筛选条件',
    button: '{column} 筛选',
    byValues: '按值',
    byCondition: '按条件',
    search: '搜索',
    values: '值',
    all: '全选',
    allMatches: '选择所有搜索结果',
    blank: '（空白）',
    noMatch: '没有匹配的值',
    more: '另有 {count} 项未列出，可以搜索',
    condition: '条件',
    value: '值',
    clear: '清除筛选',
    apply: '确定',
    added: '已对 {range} 添加筛选',
    removed: '已取消筛选',
    applied: '{column} 已筛选，显示 {shown} / {total} 行',
    sorted: '已按 {column} 排序',
    mergedSort: '含有合并单元格的区域不能排序',
    nothingToSort: '请选择要排序的多行，或先添加筛选',
  },
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
  print: '打印',
  file: {
    export: '导出',
    import: '导入',
    csv: 'CSV 文件 (.csv)',
    png: '图片 (.png)',
    svg: '矢量图 (.svg)',
    exported: '已导出 {name}',
    imported: '已导入 {name}',
    importFailed: '无法读取“{name}”：{reason}',
    unknownFile: '不支持导入“{name}”',
    exportFailed: '无法导出 {name}：{reason}',
    workbook: '整个工作簿',
    sheet: '当前工作表',
    selection: '选区',
  },
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
  changeCancelled: '這次修改沒有生效',
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
  errors: {
    '#DIV/0!': '除以 0',
    '#N/A': '沒有找到',
    '#NAME?': '沒有這個函數',
    '#NULL!': '範圍沒有交集',
    '#NUM!': '數字超出範圍',
    '#REF!': '參照的儲存格或工作表不存在',
    '#VALUE!': '值的類型不對',
    '#CYCLE!': '公式參照了自己',
    '#ERROR!': '公式寫法有誤',
  },
  functions: helpZhTW,
  nameBox: '儲存格位址',
  formulaBox: '資料編輯列',
  badAddress: '「{text}」不是儲存格位址',
  formulaSyntax: '公式寫得不完整或有誤',
  unknownFunction: '沒有名為 {name} 的函數',
  functionList: '函數',
  ops: {
    eq: '等於',
    ne: '不等於',
    gt: '大於',
    ge: '大於或等於',
    lt: '小於',
    le: '小於或等於',
    between: '介於',
    notBetween: '不介於',
    contains: '包含',
    notContains: '不包含',
    begins: '開頭是',
    ends: '結尾是',
    blank: '為空白',
    notBlank: '不為空白',
  },
  formats: {
    title: '條件格式',
    highlight: '醒目提示儲存格',
    ranks: '前段 / 後段',
    gt: '大於…',
    lt: '小於…',
    between: '介於…',
    eq: '等於…',
    contains: '文字包含…',
    duplicates: '重複值…',
    formula: '使用公式…',
    top: '前 10 項…',
    bottom: '後 10 項…',
    above: '高於平均…',
    below: '低於平均…',
    bar: '資料橫條',
    scale: '色階',
    clearSelection: '清除所選儲存格的規則',
    clearSheet: '清除此工作表的規則',
    manage: '管理規則…',
    range: '套用範圍',
    value: '值',
    and: '到',
    count: '項數',
    percent: '依百分比',
    repeated: '重複',
    unique: '唯一',
    look: '格式設定為',
    invalidRange: '請輸入儲存格範圍，如 D2:D40',
    needValue: '請輸入值',
    cancel: '取消',
    apply: '確定',
    close: '關閉',
    edit: '編輯',
    editTitle: '編輯規則',
    condition: '條件',
    formulaField: '公式',
    formulaHelp: '按區域左上角的儲存格書寫，如 =$D2>$C2',
    needFormula: '請輸入公式',
    color: '顏色',
    current: '保持原樣',
    looks: {
      danger: '淺紅填滿，深紅色文字',
      warning: '淺黃填滿，深黃色文字',
      success: '淺綠填滿，深綠色文字',
      dangerText: '紅色文字',
      bold: '粗體',
      neutral: '淺灰填滿',
    },
    scales: {
      rag: '紅 - 黃 - 綠',
      gar: '綠 - 黃 - 紅',
      diverging: '紅 - 灰 - 綠',
      blue: '灰 - 藍',
    },
    describe: {
      when: '儲存格的值{op} {value}',
      between: '儲存格的值{op} {value} 和 {to} 之間',
      formula: '公式 {formula}',
      top: '前 {count} 項',
      topPercent: '前 {count}%',
      bottom: '後 {count} 項',
      bottomPercent: '後 {count}%',
      above: '高於平均',
      below: '低於平均',
      repeated: '重複值',
      unique: '唯一值',
      scale: '色階',
      bar: '資料橫條',
    },
    empty: '此工作表没有條件格式',
    moveUp: '上移',
    moveDown: '下移',
    remove: '刪除',
    added: '已为 {range} 添加條件格式',
    cleared: '已清除 {count} 条條件格式',
  },
  validation: {
    title: '資料驗證',
    range: '套用於',
    allow: '允許',
    kinds: { list: '清單', number: '數字', integer: '整數', text: '文字', formula: '公式' },
    condition: '條件',
    any: '任意值',
    value: '值',
    and: '到',
    options: '選項',
    optionsHelp: '用逗號分隔，或參照儲存格，如 =$H$2:$H$9',
    formula: '公式',
    formulaHelp: '按區域左上角的儲存格書寫，結果為 TRUE 時符合',
    prompt: '輸入提示',
    promptHelp: '選取儲存格時顯示，選填',
    message: '錯誤提示',
    messageHelp: '選填，不填時說明規則',
    strict: '拒絕不符合的輸入',
    strictHelp: '不勾選時保留輸入的值，在儲存格角上標記',
    invalidRange: '請輸入儲存格範圍，如 D2:D40',
    needValue: '請輸入值',
    needOptions: '請輸入選項',
    needFormula: '請輸入公式',
    remove: '刪除規則',
    cancel: '取消',
    apply: '確定',
    list: '請從清單中選擇',
    number: '請輸入數字，{cond}',
    numberOnly: '請輸入數字',
    integer: '請輸入整數，{cond}',
    integerOnly: '請輸入整數',
    text: '值應{cond}',
    formulaFailed: '不符合規則 {formula}',
    cond: '{op} {value}',
    condBetween: '{op} {value} 和 {to} 之間',
    refused: '沒有寫入：{message}',
    added: '已為 {range} 設定資料驗證',
    removed: '已刪除 {range} 的資料驗證',
  },
  group: {
    group: '群組',
    groupRows: '將 {count} 列設為群組',
    groupCols: '將 {count} 欄設為群組',
    ungroupRows: '取消列群組',
    ungroupCols: '取消欄群組',
    rowLines: '第 {from}–{to} 列',
    rowLine: '第 {from} 列',
    colLines: '{from}–{to} 欄',
    colLine: '{from} 欄',
    collapseRows: '摺疊{lines}',
    expandRows: '展開{lines}',
    collapseCols: '摺疊 {lines}',
    expandCols: '展開 {lines}',
    collapsedRows: '已摺疊{lines}',
    expandedRows: '已展開{lines}',
    collapsedCols: '已摺疊 {lines}',
    expandedCols: '已展開 {lines}',
    rowLevel: '列群組顯示到第 {level} 層',
    colLevel: '欄群組顯示到第 {level} 層',
    levelShown: '已顯示到第 {level} 層',
    groupedRows: '已將 {count} 列設為群組',
    groupedCols: '已將 {count} 欄設為群組',
    ungrouped: '已取消群組',
    crossing: '無法這樣設定群組：會和群組「{group}」交叉',
    tooDeep: '無法這樣設定群組：群組最多巢狀 8 層',
  },
  note: {
    add: '插入附註',
    edit: '編輯附註',
    remove: '刪除附註',
    removeMany: '刪除 {count} 則附註',
    label: '附註',
    cellNote: '附註：{note}',
    placeholder: '輸入附註',
    save: '儲存',
    cancel: '取消',
    saved: '已儲存附註',
    removed: '已刪除附註',
    removedMany: '已刪除 {count} 則附註',
  },
  link: {
    add: '插入連結',
    edit: '編輯連結',
    remove: '刪除連結',
    open: '開啟連結',
    label: '連結',
    cellLink: '連結：{link}',
    text: '文字',
    address: '連結位址',
    addressPlaceholder: '網址，或 #A1 跳到表格裡的儲存格',
    badAddress: '只支援 http、https、mailto、tel 開頭的位址，或 # 開頭的儲存格參照',
    save: '儲存',
    cancel: '取消',
    saved: '已儲存連結',
    removed: '已刪除連結',
    jumped: '已跳到 {cell}',
    missing: '找不到連結指向的位置：{link}',
  },
  protect: {
    menu: '保護',
    protectSheet: '保護工作表',
    unprotectSheet: '取消保護工作表',
    protectBook: '保護活頁簿結構',
    unprotectBook: '取消保護活頁簿結構',
    lock: '鎖定儲存格',
    unlock: '取消鎖定儲存格',
    sheetProtected: '已保護工作表 {name}',
    sheetUnprotected: '已取消保護工作表 {name}',
    bookProtected: '已保護活頁簿結構',
    bookUnprotected: '已取消保護活頁簿結構',
    locked: '已鎖定所選儲存格',
    unlocked: '已取消鎖定所選儲存格',
    protectedSheet: '（受保護）',
    refused: {
      cell: '儲存格受保護，無法修改',
      format: '受保護的工作表無法修改鎖定儲存格的格式',
      lock: '工作表受保護時無法鎖定或解除鎖定儲存格',
      formatRows: '受保護的工作表無法調整列高或隱藏列',
      formatColumns: '受保護的工作表無法調整欄寬或隱藏欄',
      insertRows: '受保護的工作表無法插入列',
      insertColumns: '受保護的工作表無法插入欄',
      deleteRows: '受保護的工作表無法刪除列',
      deleteColumns: '受保護的工作表無法刪除欄',
      filter: '受保護的工作表無法篩選',
      sheet: '工作表受保護，無法修改',
      structure: '活頁簿結構受保護，無法新增、刪除、移動或重新命名工作表',
    },
  },
  filter: {
    sortAsc: '遞增排序',
    sortDesc: '遞減排序',
    sort: '排序',
    turnOn: '篩選',
    turnOff: '取消篩選',
    clearAll: '清除所有篩選條件',
    button: '{column} 篩選',
    byValues: '依值',
    byCondition: '依條件',
    search: '搜尋',
    values: '值',
    all: '全選',
    allMatches: '選取所有搜尋結果',
    blank: '（空白）',
    noMatch: '沒有相符的值',
    more: '另有 {count} 項未列出，可以搜尋',
    condition: '條件',
    value: '值',
    clear: '清除篩選',
    apply: '確定',
    added: '已對 {range} 加上篩選',
    removed: '已取消篩選',
    applied: '{column} 已篩選，顯示 {shown} / {total} 列',
    sorted: '已依 {column} 排序',
    mergedSort: '含有合併儲存格的範圍無法排序',
    nothingToSort: '請選取要排序的多列，或先加上篩選',
  },
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
  print: '列印',
  file: {
    export: '匯出',
    import: '匯入',
    csv: 'CSV 檔案 (.csv)',
    png: '圖片 (.png)',
    svg: '向量圖 (.svg)',
    exported: '已匯出 {name}',
    imported: '已匯入 {name}',
    importFailed: '無法讀取「{name}」：{reason}',
    unknownFile: '不支援匯入「{name}」',
    exportFailed: '無法匯出 {name}：{reason}',
    workbook: '整個活頁簿',
    sheet: '目前工作表',
    selection: '選取範圍',
  },
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
  changeCancelled: "That change wasn't made",
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
  errors: {
    '#DIV/0!': 'Divided by zero',
    '#N/A': 'Nothing was found',
    '#NAME?': 'There is no such function',
    '#NULL!': "The ranges don't meet",
    '#NUM!': 'A number is out of range',
    '#REF!': 'A cell or sheet it refers to is gone',
    '#VALUE!': 'A value of the wrong kind',
    '#CYCLE!': 'The formula depends on itself',
    '#ERROR!': 'The formula is written wrong',
  },
  functions: helpEn,
  nameBox: 'Cell address',
  formulaBox: 'Formula bar',
  badAddress: '"{text}" is not a cell address',
  formulaSyntax: 'The formula is unfinished or mistyped',
  unknownFunction: 'There is no function named {name}',
  functionList: 'Functions',
  ops: {
    eq: 'Equals',
    ne: 'Does not equal',
    gt: 'Greater than',
    ge: 'Greater than or equal to',
    lt: 'Less than',
    le: 'Less than or equal to',
    between: 'Between',
    notBetween: 'Not between',
    contains: 'Contains',
    notContains: 'Does not contain',
    begins: 'Begins with',
    ends: 'Ends with',
    blank: 'Is empty',
    notBlank: 'Is not empty',
  },
  formats: {
    title: 'Conditional formatting',
    highlight: 'Highlight cells',
    ranks: 'Top / bottom',
    gt: 'Greater than…',
    lt: 'Less than…',
    between: 'Between…',
    eq: 'Equal to…',
    contains: 'Text that contains…',
    duplicates: 'Duplicate values…',
    formula: 'Use a formula…',
    top: 'Top 10 items…',
    bottom: 'Bottom 10 items…',
    above: 'Above average…',
    below: 'Below average…',
    bar: 'Data bars',
    scale: 'Color scales',
    clearSelection: 'Clear rules from selected cells',
    clearSheet: 'Clear rules from this sheet',
    manage: 'Manage rules…',
    range: 'Applies to',
    value: 'Value',
    and: 'and',
    count: 'Items',
    percent: 'Percent',
    repeated: 'Duplicate',
    unique: 'Unique',
    look: 'Format with',
    invalidRange: 'Enter a range of cells, such as D2:D40',
    needValue: 'Enter a value',
    cancel: 'Cancel',
    apply: 'OK',
    close: 'Close',
    edit: 'Edit',
    editTitle: 'Edit rule',
    condition: 'Condition',
    formulaField: 'Formula',
    formulaHelp: 'Written for the top left cell of the range, e.g. =$D2>$C2',
    needFormula: 'Enter a formula',
    color: 'Color',
    current: 'Keep as is',
    looks: {
      danger: 'Light red fill with dark red text',
      warning: 'Light yellow fill with dark yellow text',
      success: 'Light green fill with dark green text',
      dangerText: 'Red text',
      bold: 'Bold',
      neutral: 'Light gray fill',
    },
    scales: {
      rag: 'Red - yellow - green',
      gar: 'Green - yellow - red',
      diverging: 'Red - gray - green',
      blue: 'Gray - blue',
    },
    describe: {
      when: 'Cell value {op} {value}',
      between: 'Cell value {op} {value} and {to}',
      formula: 'Formula {formula}',
      top: 'Top {count}',
      topPercent: 'Top {count}%',
      bottom: 'Bottom {count}',
      bottomPercent: 'Bottom {count}%',
      above: 'Above average',
      below: 'Below average',
      repeated: 'Duplicate values',
      unique: 'Unique values',
      scale: 'Color scale',
      bar: 'Data bar',
    },
    empty: 'This sheet has no conditional formats',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Delete',
    added: 'Added a conditional format to {range}',
    cleared: 'Cleared {count} conditional formats',
  },
  validation: {
    title: 'Data validation',
    range: 'Apply to',
    allow: 'Allow',
    kinds: {
      list: 'List',
      number: 'Number',
      integer: 'Whole number',
      text: 'Text',
      formula: 'Formula',
    },
    condition: 'Condition',
    any: 'Any value',
    value: 'Value',
    and: 'and',
    options: 'Options',
    optionsHelp: 'Separated by commas, or a reference such as =$H$2:$H$9',
    formula: 'Formula',
    formulaHelp: 'Written for the top left cell of the range; a value fits when it comes to TRUE',
    prompt: 'Input hint',
    promptHelp: 'Shown while the cell is selected; optional',
    message: 'Error message',
    messageHelp: 'Optional; the rule is described when left empty',
    strict: 'Refuse values that don’t fit',
    strictHelp: 'When off, the value is kept and its cell is marked',
    invalidRange: 'Enter a range of cells, e.g. D2:D40',
    needValue: 'Enter a value',
    needOptions: 'Enter the options',
    needFormula: 'Enter a formula',
    remove: 'Remove rule',
    cancel: 'Cancel',
    apply: 'OK',
    list: 'Pick a value from the list',
    number: 'Enter a number that is {cond}',
    numberOnly: 'Enter a number',
    integer: 'Enter a whole number that is {cond}',
    integerOnly: 'Enter a whole number',
    text: 'The value must be: {cond}',
    formulaFailed: 'Doesn’t meet {formula}',
    cond: '{op} {value}',
    condBetween: '{op} {value} and {to}',
    refused: 'Not entered: {message}',
    added: 'Data validation set on {range}',
    removed: 'Data validation removed from {range}',
  },
  group: {
    group: 'Group',
    groupRows: 'Group {count} rows',
    groupCols: 'Group {count} columns',
    ungroupRows: 'Ungroup rows',
    ungroupCols: 'Ungroup columns',
    rowLines: 'rows {from}–{to}',
    rowLine: 'row {from}',
    colLines: 'columns {from}–{to}',
    colLine: 'column {from}',
    collapseRows: 'Collapse {lines}',
    expandRows: 'Expand {lines}',
    collapseCols: 'Collapse {lines}',
    expandCols: 'Expand {lines}',
    collapsedRows: 'Collapsed {lines}',
    expandedRows: 'Expanded {lines}',
    collapsedCols: 'Collapsed {lines}',
    expandedCols: 'Expanded {lines}',
    rowLevel: 'Show row groups to level {level}',
    colLevel: 'Show column groups to level {level}',
    levelShown: 'Showing level {level}',
    groupedRows: '{count} rows grouped',
    groupedCols: '{count} columns grouped',
    ungrouped: 'Ungrouped',
    crossing: "Can't group these: they would cross the group of {group}",
    tooDeep: "Can't group these: groups nest at most 8 deep",
  },
  note: {
    add: 'Insert note',
    edit: 'Edit note',
    remove: 'Delete note',
    removeMany: 'Delete {count} notes',
    label: 'Note',
    cellNote: 'Note: {note}',
    placeholder: 'Write a note',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Note saved',
    removed: 'Note deleted',
    removedMany: '{count} notes deleted',
  },
  link: {
    add: 'Insert link',
    edit: 'Edit link',
    remove: 'Remove link',
    open: 'Open link',
    label: 'Link',
    cellLink: 'Link: {link}',
    text: 'Text',
    address: 'Link',
    addressPlaceholder: 'A web address, or #A1 for a cell in the workbook',
    badAddress:
      'Use an address starting with http, https, mailto or tel, or # and a cell reference',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Link saved',
    removed: 'Link removed',
    jumped: 'Went to {cell}',
    missing: "Can't find where the link goes: {link}",
  },
  protect: {
    menu: 'Protect',
    protectSheet: 'Protect sheet',
    unprotectSheet: 'Unprotect sheet',
    protectBook: 'Protect workbook structure',
    unprotectBook: 'Unprotect workbook structure',
    lock: 'Lock cells',
    unlock: 'Unlock cells',
    sheetProtected: '{name} protected',
    sheetUnprotected: '{name} no longer protected',
    bookProtected: 'Workbook structure protected',
    bookUnprotected: 'Workbook structure no longer protected',
    locked: 'Selected cells locked',
    unlocked: 'Selected cells unlocked',
    protectedSheet: '(protected)',
    refused: {
      cell: "The cell is protected and can't be changed",
      format: "Locked cells on a protected sheet can't be formatted",
      lock: "Cells can't be locked or unlocked while the sheet is protected",
      formatRows: "Rows on a protected sheet can't be resized or hidden",
      formatColumns: "Columns on a protected sheet can't be resized or hidden",
      insertRows: "Rows can't be inserted on a protected sheet",
      insertColumns: "Columns can't be inserted on a protected sheet",
      deleteRows: "Rows can't be deleted on a protected sheet",
      deleteColumns: "Columns can't be deleted on a protected sheet",
      filter: "A protected sheet can't be filtered",
      sheet: "The sheet is protected and can't be changed",
      structure:
        "The workbook's structure is protected: sheets can't be added, deleted, moved or renamed",
    },
  },
  filter: {
    sortAsc: 'Sort ascending',
    sortDesc: 'Sort descending',
    sort: 'Sort',
    turnOn: 'Filter',
    turnOff: 'Remove filter',
    clearAll: 'Clear all filters',
    button: 'Filter {column}',
    byValues: 'By values',
    byCondition: 'By condition',
    search: 'Search',
    values: 'Values',
    all: 'Select all',
    allMatches: 'Select all matches',
    blank: '(Blank)',
    noMatch: 'No matching values',
    more: '{count} more not listed; search to find them',
    condition: 'Condition',
    value: 'Value',
    clear: 'Clear filter',
    apply: 'Apply',
    added: 'Filter added to {range}',
    removed: 'Filter removed',
    applied: '{column} filtered: {shown} of {total} rows shown',
    sorted: 'Sorted by {column}',
    mergedSort: 'A range with merged cells cannot be sorted',
    nothingToSort: 'Select more than one row to sort, or add a filter first',
  },
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
  print: 'Print',
  file: {
    export: 'Export',
    import: 'Import',
    csv: 'CSV file (.csv)',
    png: 'Image (.png)',
    svg: 'Vector image (.svg)',
    exported: 'Exported {name}',
    imported: 'Imported {name}',
    importFailed: "Couldn't read “{name}”: {reason}",
    unknownFile: 'Can’t import “{name}”',
    exportFailed: "Couldn't export {name}: {reason}",
    workbook: 'Whole workbook',
    sheet: 'This sheet',
    selection: 'Selection',
  },
}

export const sheetLocales: Record<string, SheetMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/** The texts of exporting and importing files. */
export interface SheetFileMessages {
  export: string
  import: string
  /** The built-in exporters and importers. */
  csv: string
  png: string
  svg: string
  /** Read out after a file is written or read: `{name}`. */
  exported: string
  imported: string
  /** A file that couldn't be read: `{name}`, `{reason}`. */
  importFailed: string
  /** A file no importer takes: `{name}`. */
  unknownFile: string
  /** A file that couldn't be written: `{name}`, `{reason}`. */
  exportFailed: string
  /** What the export menu offers to write, for exporters that can write more than one. */
  workbook: string
  sheet: string
  selection: string
}

/** The texts of conditional formats. */
export interface SheetFormatsMessages {
  title: string
  highlight: string
  ranks: string
  gt: string
  lt: string
  between: string
  eq: string
  contains: string
  duplicates: string
  formula: string
  top: string
  bottom: string
  above: string
  below: string
  bar: string
  scale: string
  clearSelection: string
  clearSheet: string
  manage: string
  /** Dialog fields. */
  range: string
  value: string
  and: string
  count: string
  percent: string
  repeated: string
  unique: string
  look: string
  invalidRange: string
  needValue: string
  cancel: string
  apply: string
  close: string
  edit: string
  editTitle: string
  condition: string
  formulaField: string
  formulaHelp: string
  needFormula: string
  /** A data bar's or a scale's colors. */
  color: string
  /** Keeps a look or color the menus don't offer, when editing a rule. */
  current: string
  /** The looks to pick from. */
  looks: {
    danger: string
    warning: string
    success: string
    dangerText: string
    bold: string
    neutral: string
  }
  /** Color scales, from the smallest number to the largest. */
  scales: { rag: string; gar: string; diverging: string; blue: string }
  /** How the list of formats describes each; `{value}`, `{to}`, `{count}`, `{formula}`. */
  describe: {
    when: string
    between: string
    formula: string
    top: string
    topPercent: string
    bottom: string
    bottomPercent: string
    above: string
    below: string
    repeated: string
    unique: string
    scale: string
    bar: string
  }
  empty: string
  moveUp: string
  moveDown: string
  remove: string
  /** Read out: `{range}`, `{count}`. */
  added: string
  cleared: string
}

/** The texts of data validation: the dialog, and what is said when a value doesn't fit. */
export interface SheetValidationMessages {
  title: string
  range: string
  allow: string
  kinds: { list: string; number: string; integer: string; text: string; formula: string }
  condition: string
  any: string
  value: string
  and: string
  options: string
  optionsHelp: string
  formula: string
  formulaHelp: string
  prompt: string
  promptHelp: string
  message: string
  messageHelp: string
  strict: string
  strictHelp: string
  invalidRange: string
  needValue: string
  needOptions: string
  needFormula: string
  remove: string
  cancel: string
  apply: string
  /** A rule in words, said when a value doesn't fit: `{cond}`, `{formula}`. */
  list: string
  number: string
  numberOnly: string
  integer: string
  integerOnly: string
  text: string
  formulaFailed: string
  /** A condition in words: `{op}`, `{value}`, `{to}`. */
  cond: string
  condBetween: string
  /** Said when a typed value is refused: `{message}`. */
  refused: string
  /** Read out: `{range}`. */
  added: string
  removed: string
}

export interface SheetGroupMessages {
  /** Menu items: `{count}` rows or columns. */
  group: string
  groupRows: string
  groupCols: string
  ungroupRows: string
  ungroupCols: string
  /** Lines of a group, for the texts below: `{from}`, `{to}`; one line `{from}`. */
  rowLines: string
  rowLine: string
  colLines: string
  colLine: string
  /** A group's button, and what is read out after pressing it: `{lines}`. */
  collapseRows: string
  expandRows: string
  collapseCols: string
  expandCols: string
  collapsedRows: string
  expandedRows: string
  collapsedCols: string
  expandedCols: string
  /** The level buttons, and what is read out after one: `{level}`. */
  rowLevel: string
  colLevel: string
  levelShown: string
  /** Read out after grouping: `{count}` rows or columns. */
  groupedRows: string
  groupedCols: string
  ungrouped: string
  /** Grouping lines that would cross the group `{group}`, or nest too deep. */
  crossing: string
  tooDeep: string
}

export interface SheetLinkMessages {
  /** Menu items and the card's buttons. */
  add: string
  edit: string
  remove: string
  open: string
  /** The edit box's name, and a cell's link as read out: `{link}`. */
  label: string
  cellLink: string
  /** The edit box's fields. */
  text: string
  address: string
  addressPlaceholder: string
  /** Shown for an address that won't be followed. */
  badAddress: string
  save: string
  cancel: string
  /** Read out after a change, and after following a link in the workbook: `{cell}`. */
  saved: string
  removed: string
  jumped: string
  /** Shown when a link into the workbook goes nowhere, such as to a sheet that is gone: `{link}`. */
  missing: string
}

export interface SheetProtectMessages {
  /** The toolbar's menu of these, and its items. */
  menu: string
  protectSheet: string
  unprotectSheet: string
  protectBook: string
  unprotectBook: string
  lock: string
  unlock: string
  /** Read out after a change: `{name}` is the sheet's. */
  sheetProtected: string
  sheetUnprotected: string
  bookProtected: string
  bookUnprotected: string
  locked: string
  unlocked: string
  /** Read out after a protected sheet's name on its tab. */
  protectedSheet: string
  /** Shown when a change runs into protection, by what it ran into. */
  refused: Record<SheetProtectionRefusal, string>
}

export interface SheetNoteMessages {
  /** Menu items. */
  add: string
  edit: string
  remove: string
  /** `{count}` notes in the selection. */
  removeMany: string
  /** The note box's name, and the note as read out with its cell: `{note}`. */
  label: string
  cellNote: string
  placeholder: string
  save: string
  cancel: string
  /** Read out after a change; `{count}` notes. */
  saved: string
  removed: string
  removedMany: string
}

export interface SheetFilterMessages {
  /** Menu and toolbar items. */
  sortAsc: string
  sortDesc: string
  sort: string
  turnOn: string
  turnOff: string
  clearAll: string
  /** A column's filter button: `{column}` is its heading or letter. */
  button: string
  /** The panel. */
  byValues: string
  byCondition: string
  search: string
  values: string
  all: string
  allMatches: string
  blank: string
  noMatch: string
  /** More values than listed: `{count}`. */
  more: string
  condition: string
  value: string
  clear: string
  apply: string
  /** Read out: `{range}`, `{shown}` rows of `{total}`, `{column}`. */
  added: string
  removed: string
  applied: string
  sorted: string
  /** Sorting a range with merged cells. */
  mergedSort: string
  /** Sorting with nothing to sort: one row selected and no filter. */
  nothingToSort: string
}

/** The texts for a language, such as `zh-CN`; Chinese or English by its first part, English otherwise. */
export function sheetMessagesFor(locale = 'zh-CN'): SheetMessages {
  return (
    sheetLocales[locale] ??
    sheetLocales[locale.split('-')[0]!] ??
    (locale.startsWith('zh') ? zhCN : en)
  )
}

/** Fills `{name}` placeholders. */
export const format = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match))
