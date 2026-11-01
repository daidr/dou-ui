import { useLocale } from 'dou-ui'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/** The texts of the builder: its panels, actions, announcements and the settings of the built-in types. */
export interface FormBuilderMessages {
  /** Names of the built-in field types and of the containers, by type. */
  types: Record<string, string>
  /** Names of the palette's groups, by the `group` of a field type. */
  groups: Record<string, string>
  palette: {
    /** The palette's search box, read out and shown when empty. */
    search: string
    /** Shown when no type matches the search. */
    empty: string
    /** Read out on a type: `{label}`. */
    add: string
  }
  outline: { label: string; expand: string; collapse: string }
  canvas: {
    /** Names the canvas for screen readers. */
    label: string
    /** Shown on an empty form or container. */
    empty: string
    /** Shown on an empty form or container of a `readonly` builder. */
    readonlyEmpty: string
  }
  /** The tabs of the side panel. */
  /** `side` names the pane, or the button that opens it, holding the fields and the outline. */
  panels: { side: string; fields: string; outline: string; settings: string }
  actions: {
    parent: string
    up: string
    down: string
    duplicate: string
    remove: string
    /** The button that holds the other actions when a node is too narrow to show them. */
    more: string
    /** On phones: taps add nodes to the selection instead of replacing it. */
    selectMany: string
    wrap: string
    addPage: string
    undo: string
    redo: string
  }
  inspector: {
    /** Heading when nothing is selected: the form's own settings. */
    form: string
    /** Heading of several selected nodes: `{count}`. */
    multiple: string
    /** Heading over the settings of the field type. */
    type: string
    /** Headings over the checks, and over when the node shows, is disabled or required. */
    rules: string
    logic: string
  }
  /** Read out after a change. */
  announce: {
    inserted: string
    removed: string
    duplicated: string
    moved: string
    /** After a drag or `moveTo`: `{where}` is the container, `{count}` how many nodes moved. */
    movedTo: string
    movedManyTo: string
    wrapped: string
    undone: string
    redone: string
    /** After the whole form was replaced, e.g. by imported JSON. */
    replaced: string
  }
  /** The condition editor: rows of "field, how, value". */
  condition: {
    /** A line of the canvas mark's tooltip: a setting and its expression. `{label}`, `{text}`. */
    summary: string
    /** Names a row for screen readers, followed by its number. */
    row: string
    field: string
    operator: string
    value: string
    add: string
    remove: string
    /** How the rows combine. */
    all: string
    any: string
    /** Switch to writing the expression, and back. */
    toText: string
    toRows: string
    /** Why the expression cannot be shown as rows. */
    notRows: string
    yes: string
    no: string
    /** Groups of the field list inside a list: the item's fields and the form's. */
    itemGroup: string
    formGroup: string
    operators: Record<string, string>
    /** Names of the comparisons of dates, where they differ. */
    dateOperators: Record<string, string>
  }
  /** Expression text: what the completions mean, and the problems by their code. `{text}` is the text at fault. */
  expression: {
    values: string
    item: string
    value: string
    problems: Record<string, string>
    /** What the built-in functions take and do, for hover text and parameter hints. */
    functions: Record<string, { signature: string; info: string }>
    /** Shown beside `true`, `false`, `null` and `in` in completions. */
    keyword: string
  }
  preview: {
    /** The button that shows the preview. */
    toggle: string
    label: string
    device: string
    devices: { desktop: string; tablet: string; phone: string }
    submit: string
    reset: string
    /** Over the values a submit would send. */
    passed: string
  }
  /** The JSON of the form. */
  json: {
    title: string
    /** Lays the text out again, two spaces a level. */
    format: string
    file: string
    download: string
    copy: string
    copied: string
    cancel: string
    apply: string
    /** Closes the dialog of a `readonly` builder, which cannot apply anything. */
    close: string
    syntax: string
    /** `{line}`, `{column}`. */
    syntaxAt: string
    fine: string
    /** `{count}` problems not listed. */
    more: string
    /** A value of the wrong kind, by what it should be, and `required` for one that is missing. */
    shape: Record<string, string>
    /** The problems of `checkDocument`, by code. */
    problems: Record<string, string>
  }
  /** Moving nodes by dragging, or with the keyboard after `Space`. `{index}` counts from 1. */
  drag: {
    /** Read out before the first place, so it ends with its own stop. */
    picked: string
    place: string
    /** The top of the form, as `{where}` in `place`. */
    top: string
    cancelled: string
    /** The handle on a node's edge that changes its width. */
    resize: string
  }
  /** What new nodes are called. `{index}` counts from 1. */
  created: {
    option: string
    page: string
    step: string
    text: string
    alert: string
  }
  /** Labels of the settings, by key. */
  settings: Record<string, string>
  /** Choices of the settings, by setting and value. */
  choices: Record<string, Record<string, string>>
  errors: {
    /** A field holding a value needs a name. */
    name: string
    /** `{text}`: the name. */
    taken: string
  }
}

const zhCN: FormBuilderMessages = {
  types: {
    input: '单行文本',
    textarea: '多行文本',
    'input-number': '数字',
    select: '下拉选择',
    'radio-group': '单选',
    'checkbox-group': '多选',
    checkbox: '勾选框',
    switch: '开关',
    'segmented-control': '分段选择',
    slider: '滑块',
    rate: '评分',
    'date-picker': '日期',
    'time-picker': '时间',
    'color-picker': '颜色',
    cascader: '级联选择',
    'tree-select': '树形选择',
    'input-tag': '标签输入',
    'input-otp': '验证码',
    upload: '上传',
    text: '文字',
    divider: '分割线',
    alert: '提示',
    section: '分组',
    tabs: '标签页',
    steps: '分步',
    page: '页面',
    list: '列表',
  },
  groups: { input: '输入', choice: '选择', more: '更多', display: '展示', layout: '布局' },
  palette: { search: '搜索字段', empty: '没有匹配的字段', add: '添加{label}' },
  outline: { label: '表单结构', expand: '展开', collapse: '收起' },
  canvas: { label: '表单画布', empty: '点击字段添加到这里', readonlyEmpty: '这里还没有内容' },
  panels: { side: '字段与结构', fields: '字段', outline: '结构', settings: '设置' },
  actions: {
    parent: '选中上一级',
    up: '上移',
    down: '下移',
    duplicate: '复制',
    remove: '删除',
    more: '更多操作',
    selectMany: '多选',
    wrap: '放进分组',
    addPage: '添加页面',
    undo: '撤销',
    redo: '重做',
  },
  inspector: {
    form: '表单',
    multiple: '已选中 {count} 项',
    type: '组件设置',
    rules: '校验',
    logic: '联动',
  },
  announce: {
    inserted: '已添加{label}',
    removed: '已删除 {count} 项',
    duplicated: '已复制 {count} 项',
    moved: '已移到第 {index} 位',
    movedTo: '已移到{where}的第 {index} 位',
    movedManyTo: '已把 {count} 个节点移到{where}的第 {index} 位',
    wrapped: '已放进分组',
    undone: '已撤销',
    redone: '已重做',
    replaced: '已换成导入的表单',
  },
  condition: {
    summary: '{label}：{text}',
    row: '条件',
    field: '字段',
    operator: '比较方式',
    value: '值',
    add: '添加条件',
    remove: '删除这条条件',
    all: '满足全部条件',
    any: '满足任一条件',
    toText: '写成表达式',
    toRows: '改用条件',
    notRows: '这个表达式不能拆成条件',
    yes: '是',
    no: '否',
    itemGroup: '列表这一项',
    formGroup: '表单',
    operators: {
      eq: '等于',
      ne: '不等于',
      gt: '大于',
      ge: '大于等于',
      lt: '小于',
      le: '小于等于',
      in: '是其中之一',
      contains: '包含',
      empty: '为空',
      filled: '不为空',
    },
    dateOperators: { gt: '晚于', ge: '不早于', lt: '早于', le: '不晚于' },
  },
  expression: {
    values: '表单的值',
    item: '列表这一项的值',
    value: '这个字段的值',
    functions: {
      len: { signature: 'len(value)', info: '文字的字数、列表的项数' },
      empty: { signature: 'empty(value)', info: '是否为空：空文字、空列表、没有值' },
      number: { signature: 'number(value)', info: '转成数字；没有值时得到 null' },
      sum: { signature: 'sum(...numbers)', info: '求和，可以传列表' },
      min: { signature: 'min(...numbers)', info: '最小的数' },
      max: { signature: 'max(...numbers)', info: '最大的数' },
      round: { signature: 'round(value, digits?)', info: '四舍五入到 digits 位小数，默认取整' },
      abs: { signature: 'abs(value)', info: '绝对值' },
      today: { signature: 'today(offset?)', info: '今天的日期（YYYY-MM-DD），offset 是往后的天数' },
      days: { signature: 'days(from, to)', info: '两个日期相差的天数' },
      contains: { signature: 'contains(collection, item)', info: '文字或列表里是否有 item' },
    },
    keyword: '关键字',
    problems: {
      'unexpected-character': '不认识的字符“{text}”',
      'unterminated-string': '文字缺少结尾的引号',
      'unexpected-token': '这里不应出现“{text}”',
      'unexpected-end': '表达式还没写完',
      'unknown-name': '不认识的名字“{text}”，字段要写成 values.字段名',
      assignment: '比较是否相等要用 ==',
      'too-deep': '表达式嵌套太深',
      'too-long': '表达式太长',
      'unknown-field': '没有字段“{text}”',
      'unknown-function': '没有函数“{text}”',
    },
  },
  preview: {
    toggle: '预览',
    label: '表单预览',
    device: '预览宽度',
    devices: { desktop: '桌面', tablet: '平板', phone: '手机' },
    submit: '提交',
    reset: '重置',
    passed: '校验通过，会提交这些值',
  },
  json: {
    title: '表单 JSON',
    format: '格式化',
    file: '打开文件',
    download: '下载',
    copy: '复制',
    copied: '已复制',
    cancel: '取消',
    apply: '应用',
    close: '关闭',
    syntax: 'JSON 格式有误',
    syntaxAt: '第 {line} 行第 {column} 列：JSON 格式有误',
    fine: '没有发现问题',
    more: '还有 {count} 个问题',
    shape: {
      required: '缺少这一项',
      object: '应为对象',
      array: '应为数组',
      string: '应为文字',
      number: '应为数字',
      boolean: '应为 true 或 false',
      span: '应为数字，或按表单宽度分别设置的对象',
      mark: '应为 true、false 或 "optional"',
    },
    problems: {
      version: '不认识的版本 {text}',
      'duplicate-id': 'id“{text}”重复',
      'missing-name': '缺少字段名',
      'duplicate-name': '字段名“{text}”重复',
      'unknown-type': '没有“{text}”这种字段类型',
      'misplaced-page': '页面只能放在标签页或分步里',
      'not-a-page': '标签页和分步里只能放页面',
      empty: '里面还是空的',
      'formula-cycle': '公式互相引用：{text}',
    },
  },
  drag: {
    picked: '已拿起，用方向键选择位置，Enter 放下，Esc 取消。',
    place: '放到{where}的第 {index} 位',
    top: '表单最外层',
    cancelled: '已取消移动',
    resize: '拖动调整宽度',
  },
  created: {
    option: '选项 {index}',
    page: '页面 {index}',
    step: '第 {index} 步',
    text: '一段说明文字',
    alert: '提示',
  },
  settings: {
    name: '字段名',
    nameHelp: '值写在表单值的这个路径下，如 contact.phone',
    itemName: '字段名',
    itemNameHelp: '值写在列表每一项的这个键下',
    label: '标签',
    help: '提示文字',
    default: '默认值',
    required: '必填',
    span: '宽度',
    spanResponsive: '按表单宽度分别设置',
    title: '标题',
    description: '说明',
    bordered: '显示边框',
    columns: '栅格列数',
    minItems: '最少项数',
    maxItems: '最多项数',
    sortable: '可以拖动排序',
    addText: '添加按钮文字',
    layout: '标签位置',
    labelAlign: '标签对齐',
    labelWidth: '标签宽度',
    size: '尺寸',
    requiredMark: '必填标记',
    placeholder: '占位文字',
    clearable: '可以清空',
    showCount: '显示字数',
    maxlength: '最多字数',
    rows: '行数',
    autosize: '随内容增高',
    min: '最小值',
    max: '最大值',
    step: '步长',
    precision: '小数位数',
    controls: '显示加减按钮',
    options: '选项',
    optionLabel: '文字',
    optionValue: '值',
    multiple: '可以多选',
    filterable: '可以搜索',
    direction: '排列',
    text: '旁边的文字',
    range: '选择一个范围',
    allowHalf: '可以选半星',
    count: '星星数',
    dateType: '选择的单位',
    showAlpha: '可以调透明度',
    maxTags: '最多标签数',
    length: '位数',
    mask: '隐藏输入的内容',
    accept: '接受的文件类型',
    maxCount: '最多文件数',
    dropzone: '显示拖放区域',
    content: '内容',
    variant: '样式',
    dashed: '虚线',
    tone: '语气',
    visibleWhen: '显示条件',
    visibleWhenHelp: '满足条件时才显示；不设置时总是显示',
    disabledWhen: '禁用条件',
    disabledWhenHelp: '满足条件时不能填写',
    requiredWhen: '必填条件',
    requiredWhenHelp: '满足条件时必填，设置后代替上面的“必填”',
    formula: '计算公式',
    formulaHelp: '值由公式算出，不能手动填写',
    addRule: '添加规则',
    ruleKind: '规则',
    ruleType: '格式',
    ruleMin: '最小',
    ruleMax: '最大',
    ruleRangeHelp: '文字按字数，多选和列表按个数，数字按大小',
    rulePattern: '正则表达式',
    ruleFlags: '标志',
    ruleCheck: '表达式',
    ruleCheckHelp: 'value 是这个字段的值，values 是整个表单；结果为真时通过',
    ruleValidator: '校验函数',
    ruleValidatorHelp: '由使用表单的代码通过 validators 提供，可以请求接口',
    ruleMessage: '出错时的提示',
    ruleTrigger: '检查时机',
  },
  choices: {
    layout: { vertical: '在上方', horizontal: '在左侧', inline: '排成一行' },
    labelAlign: { start: '靠左', end: '靠右' },
    size: { sm: '小', md: '中', lg: '大' },
    requiredMark: { true: '星号', optional: '标注选填', false: '不标注' },
    direction: { horizontal: '横向', vertical: '纵向' },
    dateType: {
      date: '日',
      week: '周',
      month: '月',
      quarter: '季度',
      year: '年',
      datetime: '日期和时间',
    },
    variant: { title: '标题', body: '正文', caption: '小字' },
    ruleKind: {
      type: '格式',
      range: '范围',
      pattern: '正则',
      check: '表达式',
      validator: '校验函数',
    },
    ruleType: { email: '邮箱', url: '网址', number: '数字', integer: '整数', string: '文字' },
    ruleTrigger: { auto: '默认', change: '输入时', blur: '离开时' },
    tone: { neutral: '中性', primary: '强调', success: '成功', warning: '警告', danger: '危险' },
    breakpoint: { base: '最窄', sm: '≥ 480', md: '≥ 640', lg: '≥ 800', xl: '≥ 960' },
  },
  errors: { name: '请填写字段名', taken: '字段名“{text}”已经用过了' },
}

const zhTW: FormBuilderMessages = {
  types: {
    input: '單行文字',
    textarea: '多行文字',
    'input-number': '數字',
    select: '下拉選擇',
    'radio-group': '單選',
    'checkbox-group': '多選',
    checkbox: '勾選框',
    switch: '開關',
    'segmented-control': '分段選擇',
    slider: '滑桿',
    rate: '評分',
    'date-picker': '日期',
    'time-picker': '時間',
    'color-picker': '顏色',
    cascader: '級聯選擇',
    'tree-select': '樹狀選擇',
    'input-tag': '標籤輸入',
    'input-otp': '驗證碼',
    upload: '上傳',
    text: '文字',
    divider: '分隔線',
    alert: '提示',
    section: '分組',
    tabs: '分頁',
    steps: '分步',
    page: '頁面',
    list: '清單',
  },
  groups: { input: '輸入', choice: '選擇', more: '更多', display: '展示', layout: '版面' },
  palette: { search: '搜尋欄位', empty: '沒有符合的欄位', add: '新增{label}' },
  outline: { label: '表單結構', expand: '展開', collapse: '收合' },
  canvas: { label: '表單畫布', empty: '點選欄位新增到這裡', readonlyEmpty: '這裡還沒有內容' },
  panels: { side: '欄位與結構', fields: '欄位', outline: '結構', settings: '設定' },
  actions: {
    parent: '選取上一層',
    up: '上移',
    down: '下移',
    duplicate: '複製',
    remove: '刪除',
    more: '更多操作',
    selectMany: '多選',
    wrap: '放進分組',
    addPage: '新增頁面',
    undo: '復原',
    redo: '重做',
  },
  inspector: {
    form: '表單',
    multiple: '已選取 {count} 項',
    type: '元件設定',
    rules: '驗證',
    logic: '連動',
  },
  announce: {
    inserted: '已新增{label}',
    removed: '已刪除 {count} 項',
    duplicated: '已複製 {count} 項',
    moved: '已移到第 {index} 位',
    movedTo: '已移到{where}的第 {index} 位',
    movedManyTo: '已把 {count} 个节点移到{where}的第 {index} 位',
    wrapped: '已放進分組',
    undone: '已復原',
    redone: '已重做',
    replaced: '已換成匯入的表單',
  },
  condition: {
    summary: '{label}：{text}',
    row: '條件',
    field: '欄位',
    operator: '比較方式',
    value: '值',
    add: '新增條件',
    remove: '刪除這條條件',
    all: '符合全部條件',
    any: '符合任一條件',
    toText: '寫成運算式',
    toRows: '改用條件',
    notRows: '這個運算式無法拆成條件',
    yes: '是',
    no: '否',
    itemGroup: '清單這一項',
    formGroup: '表單',
    operators: {
      eq: '等於',
      ne: '不等於',
      gt: '大於',
      ge: '大於等於',
      lt: '小於',
      le: '小於等於',
      in: '是其中之一',
      contains: '包含',
      empty: '為空',
      filled: '不為空',
    },
    dateOperators: { gt: '晚於', ge: '不早於', lt: '早於', le: '不晚於' },
  },
  expression: {
    values: '表單的值',
    item: '清單這一項的值',
    value: '這個欄位的值',
    functions: {
      len: { signature: 'len(value)', info: '文字的字數、清單的項數' },
      empty: { signature: 'empty(value)', info: '是否為空：空文字、空清單、沒有值' },
      number: { signature: 'number(value)', info: '轉成數字；沒有值時得到 null' },
      sum: { signature: 'sum(...numbers)', info: '加總，可以傳入清單' },
      min: { signature: 'min(...numbers)', info: '最小的數' },
      max: { signature: 'max(...numbers)', info: '最大的數' },
      round: { signature: 'round(value, digits?)', info: '四捨五入到 digits 位小數，預設取整數' },
      abs: { signature: 'abs(value)', info: '絕對值' },
      today: { signature: 'today(offset?)', info: '今天的日期（YYYY-MM-DD），offset 是往後的天數' },
      days: { signature: 'days(from, to)', info: '兩個日期相差的天數' },
      contains: { signature: 'contains(collection, item)', info: '文字或清單裡是否有 item' },
    },
    keyword: '關鍵字',
    problems: {
      'unexpected-character': '無法辨識的字元「{text}」',
      'unterminated-string': '文字缺少結尾的引號',
      'unexpected-token': '這裡不應出現「{text}」',
      'unexpected-end': '運算式還沒寫完',
      'unknown-name': '無法辨識的名稱「{text}」，欄位要寫成 values.欄位名稱',
      assignment: '比較是否相等要用 ==',
      'too-deep': '運算式巢狀太深',
      'too-long': '運算式太長',
      'unknown-field': '沒有欄位「{text}」',
      'unknown-function': '沒有函式「{text}」',
    },
  },
  preview: {
    toggle: '預覽',
    label: '表單預覽',
    device: '預覽寬度',
    devices: { desktop: '桌面', tablet: '平板', phone: '手機' },
    submit: '送出',
    reset: '重設',
    passed: '驗證通過，會送出這些值',
  },
  json: {
    title: '表單 JSON',
    format: '格式化',
    file: '開啟檔案',
    download: '下載',
    copy: '複製',
    copied: '已複製',
    cancel: '取消',
    apply: '套用',
    close: '關閉',
    syntax: 'JSON 格式有誤',
    syntaxAt: '第 {line} 行第 {column} 欄：JSON 格式有誤',
    fine: '沒有發現問題',
    more: '還有 {count} 個問題',
    shape: {
      required: '缺少這一項',
      object: '應為物件',
      array: '應為陣列',
      string: '應為文字',
      number: '應為數字',
      boolean: '應為 true 或 false',
      span: '應為數字，或依表單寬度分別設定的物件',
      mark: '應為 true、false 或 "optional"',
    },
    problems: {
      version: '無法辨識的版本 {text}',
      'duplicate-id': 'id「{text}」重複',
      'missing-name': '缺少欄位名稱',
      'duplicate-name': '欄位名稱「{text}」重複',
      'unknown-type': '沒有「{text}」這種欄位類型',
      'misplaced-page': '頁面只能放在分頁或步驟裡',
      'not-a-page': '分頁和步驟裡只能放頁面',
      empty: '裡面還是空的',
      'formula-cycle': '公式互相參照：{text}',
    },
  },
  drag: {
    picked: '已拿起，用方向鍵選擇位置，Enter 放下，Esc 取消。',
    place: '放到{where}的第 {index} 位',
    top: '表單最外層',
    cancelled: '已取消移動',
    resize: '拖動調整寬度',
  },
  created: {
    option: '選項 {index}',
    page: '頁面 {index}',
    step: '第 {index} 步',
    text: '一段說明文字',
    alert: '提示',
  },
  settings: {
    name: '欄位名稱',
    nameHelp: '值寫在表單值的這個路徑下，如 contact.phone',
    itemName: '欄位名稱',
    itemNameHelp: '值寫在清單每一項的這個鍵下',
    label: '標籤',
    help: '提示文字',
    default: '預設值',
    required: '必填',
    span: '寬度',
    spanResponsive: '依表單寬度分別設定',
    title: '標題',
    description: '說明',
    bordered: '顯示邊框',
    columns: '格線欄數',
    minItems: '最少項數',
    maxItems: '最多項數',
    sortable: '可以拖曳排序',
    addText: '新增按鈕文字',
    layout: '標籤位置',
    labelAlign: '標籤對齊',
    labelWidth: '標籤寬度',
    size: '尺寸',
    requiredMark: '必填標記',
    placeholder: '提示文字',
    clearable: '可以清除',
    showCount: '顯示字數',
    maxlength: '最多字數',
    rows: '行數',
    autosize: '隨內容增高',
    min: '最小值',
    max: '最大值',
    step: '間隔',
    precision: '小數位數',
    controls: '顯示加減按鈕',
    options: '選項',
    optionLabel: '文字',
    optionValue: '值',
    multiple: '可以多選',
    filterable: '可以搜尋',
    direction: '排列',
    text: '旁邊的文字',
    range: '選擇一個範圍',
    allowHalf: '可以選半星',
    count: '星星數',
    dateType: '選擇的單位',
    showAlpha: '可以調透明度',
    maxTags: '最多標籤數',
    length: '位數',
    mask: '隱藏輸入的內容',
    accept: '接受的檔案類型',
    maxCount: '最多檔案數',
    dropzone: '顯示拖放區域',
    content: '內容',
    variant: '樣式',
    dashed: '虛線',
    tone: '語氣',
    visibleWhen: '顯示條件',
    visibleWhenHelp: '符合條件時才顯示；未設定時一律顯示',
    disabledWhen: '停用條件',
    disabledWhenHelp: '符合條件時無法填寫',
    requiredWhen: '必填條件',
    requiredWhenHelp: '符合條件時必填，設定後取代上面的「必填」',
    formula: '計算公式',
    formulaHelp: '值由公式算出，無法手動填寫',
    addRule: '新增規則',
    ruleKind: '規則',
    ruleType: '格式',
    ruleMin: '最小',
    ruleMax: '最大',
    ruleRangeHelp: '文字依字數，多選和清單依個數，數字依大小',
    rulePattern: '正規表示式',
    ruleFlags: '旗標',
    ruleCheck: '運算式',
    ruleCheckHelp: 'value 是這個欄位的值，values 是整個表單；結果為真時通過',
    ruleValidator: '校驗函式',
    ruleValidatorHelp: '由使用表單的程式碼透過 validators 提供，可以請求介面',
    ruleMessage: '出錯時的提示',
    ruleTrigger: '檢查時機',
  },
  choices: {
    layout: { vertical: '在上方', horizontal: '在左側', inline: '排成一行' },
    labelAlign: { start: '靠左', end: '靠右' },
    size: { sm: '小', md: '中', lg: '大' },
    requiredMark: { true: '星號', optional: '標註選填', false: '不標註' },
    direction: { horizontal: '橫向', vertical: '縱向' },
    dateType: {
      date: '日',
      week: '週',
      month: '月',
      quarter: '季',
      year: '年',
      datetime: '日期和時間',
    },
    variant: { title: '標題', body: '內文', caption: '小字' },
    ruleKind: {
      type: '格式',
      range: '範圍',
      pattern: '正規',
      check: '運算式',
      validator: '校驗函式',
    },
    ruleType: { email: '電子郵件', url: '網址', number: '數字', integer: '整數', string: '文字' },
    ruleTrigger: { auto: '預設', change: '輸入時', blur: '離開時' },
    tone: { neutral: '中性', primary: '強調', success: '成功', warning: '警告', danger: '危險' },
    breakpoint: { base: '最窄', sm: '≥ 480', md: '≥ 640', lg: '≥ 800', xl: '≥ 960' },
  },
  errors: { name: '請填寫欄位名稱', taken: '欄位名稱「{text}」已經用過了' },
}

const en: FormBuilderMessages = {
  types: {
    input: 'Short text',
    textarea: 'Long text',
    'input-number': 'Number',
    select: 'Select',
    'radio-group': 'Single choice',
    'checkbox-group': 'Multiple choice',
    checkbox: 'Checkbox',
    switch: 'Switch',
    'segmented-control': 'Segmented',
    slider: 'Slider',
    rate: 'Rating',
    'date-picker': 'Date',
    'time-picker': 'Time',
    'color-picker': 'Color',
    cascader: 'Cascader',
    'tree-select': 'Tree select',
    'input-tag': 'Tags',
    'input-otp': 'Code',
    upload: 'Upload',
    text: 'Text',
    divider: 'Divider',
    alert: 'Alert',
    section: 'Section',
    tabs: 'Tabs',
    steps: 'Steps',
    page: 'Page',
    list: 'List',
  },
  groups: { input: 'Input', choice: 'Choice', more: 'More', display: 'Display', layout: 'Layout' },
  palette: { search: 'Search fields', empty: 'No field matches', add: 'Add {label}' },
  outline: { label: 'Form outline', expand: 'Expand', collapse: 'Collapse' },
  canvas: {
    label: 'Form canvas',
    empty: 'Click a field to add it here',
    readonlyEmpty: 'There is nothing in here yet',
  },
  panels: {
    side: 'Fields and outline',
    fields: 'Fields',
    outline: 'Outline',
    settings: 'Settings',
  },
  actions: {
    parent: 'Select parent',
    up: 'Move up',
    down: 'Move down',
    duplicate: 'Duplicate',
    remove: 'Delete',
    more: 'More actions',
    selectMany: 'Select several',
    wrap: 'Put in a section',
    addPage: 'Add page',
    undo: 'Undo',
    redo: 'Redo',
  },
  inspector: {
    form: 'Form',
    multiple: '{count} selected',
    type: 'Component',
    rules: 'Checks',
    logic: 'Logic',
  },
  announce: {
    inserted: '{label} added',
    removed: '{count} deleted',
    duplicated: '{count} duplicated',
    moved: 'Moved to position {index}',
    movedTo: 'Moved to {where}, position {index}',
    movedManyTo: 'Moved {count} nodes to {where}, position {index}',
    wrapped: 'Put in a section',
    undone: 'Undone',
    redone: 'Redone',
    replaced: 'Replaced with the imported form',
  },
  condition: {
    summary: '{label}: {text}',
    row: 'Condition',
    field: 'Field',
    operator: 'Comparison',
    value: 'Value',
    add: 'Add a condition',
    remove: 'Remove this condition',
    all: 'All of them',
    any: 'Any of them',
    toText: 'Write an expression',
    toRows: 'Use conditions',
    notRows: 'This expression cannot be split into conditions',
    yes: 'Yes',
    no: 'No',
    itemGroup: 'This item',
    formGroup: 'Form',
    operators: {
      eq: 'is',
      ne: 'is not',
      gt: 'is more than',
      ge: 'is at least',
      lt: 'is less than',
      le: 'is at most',
      in: 'is one of',
      contains: 'contains',
      empty: 'is empty',
      filled: 'is not empty',
    },
    dateOperators: { gt: 'is after', ge: 'is not before', lt: 'is before', le: 'is not after' },
  },
  expression: {
    values: 'The form’s values',
    item: 'This item’s values',
    value: 'This field’s value',
    functions: {
      len: { signature: 'len(value)', info: 'The length of a text or the items of a list' },
      empty: {
        signature: 'empty(value)',
        info: 'Whether it is empty: no text, no items, no value',
      },
      number: { signature: 'number(value)', info: 'As a number; null when there is no value' },
      sum: { signature: 'sum(...numbers)', info: 'The total; lists count too' },
      min: { signature: 'min(...numbers)', info: 'The smallest number' },
      max: { signature: 'max(...numbers)', info: 'The largest number' },
      round: {
        signature: 'round(value, digits?)',
        info: 'Rounded to digits decimals, whole by default',
      },
      abs: { signature: 'abs(value)', info: 'The absolute value' },
      today: { signature: 'today(offset?)', info: 'Today as YYYY-MM-DD, offset days later' },
      days: { signature: 'days(from, to)', info: 'The days from one date to another' },
      contains: {
        signature: 'contains(collection, item)',
        info: 'Whether a text or list holds item',
      },
    },
    keyword: 'Keyword',
    problems: {
      'unexpected-character': 'Unexpected character “{text}”',
      'unterminated-string': 'The text is missing its closing quote',
      'unexpected-token': '“{text}” does not belong here',
      'unexpected-end': 'The expression is not finished',
      'unknown-name': 'Unknown name “{text}”; write fields as values.name',
      assignment: 'Use == to compare two values',
      'too-deep': 'The expression nests too deeply',
      'too-long': 'The expression is too long',
      'unknown-field': 'There is no field “{text}”',
      'unknown-function': 'There is no function “{text}”',
    },
  },
  preview: {
    toggle: 'Preview',
    label: 'Form preview',
    device: 'Preview width',
    devices: { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' },
    submit: 'Submit',
    reset: 'Reset',
    passed: 'All checks passed. These values would be sent:',
  },
  json: {
    title: 'Form JSON',
    format: 'Format',
    file: 'Open file',
    download: 'Download',
    copy: 'Copy',
    copied: 'Copied',
    cancel: 'Cancel',
    apply: 'Apply',
    close: 'Close',
    syntax: 'The JSON is not valid',
    syntaxAt: 'Line {line}, column {column}: the JSON is not valid',
    fine: 'No problems found',
    more: '{count} more problems',
    shape: {
      required: 'Missing',
      object: 'Should be an object',
      array: 'Should be an array',
      string: 'Should be text',
      number: 'Should be a number',
      boolean: 'Should be true or false',
      span: 'Should be a number, or an object of numbers by form width',
      mark: 'Should be true, false or "optional"',
    },
    problems: {
      version: 'Version {text} is not known',
      'duplicate-id': 'The id “{text}” is used twice',
      'missing-name': 'The field has no name',
      'duplicate-name': 'The name “{text}” is used twice',
      'unknown-type': 'There is no field type “{text}”',
      'misplaced-page': 'A page belongs in tabs or steps',
      'not-a-page': 'Tabs and steps hold pages only',
      empty: 'It is empty',
      'formula-cycle': 'The formulas read each other: {text}',
    },
  },
  drag: {
    picked: 'Picked up. Use the arrow keys to choose a place, Enter to drop, Escape to cancel. ',
    place: 'In {where}, position {index}',
    top: 'the top of the form',
    cancelled: 'Move cancelled',
    resize: 'Drag to change the width',
  },
  created: {
    option: 'Option {index}',
    page: 'Page {index}',
    step: 'Step {index}',
    text: 'Some text',
    alert: 'Note',
  },
  settings: {
    name: 'Name',
    nameHelp: 'The path the value is written to, e.g. contact.phone',
    itemName: 'Name',
    itemNameHelp: 'The key the value is written to in each item',
    label: 'Label',
    help: 'Help',
    default: 'Default',
    required: 'Required',
    span: 'Width',
    spanResponsive: 'By form width',
    title: 'Title',
    description: 'Description',
    bordered: 'Border',
    columns: 'Grid columns',
    minItems: 'Fewest items',
    maxItems: 'Most items',
    sortable: 'Can be reordered',
    addText: 'Add button text',
    layout: 'Labels',
    labelAlign: 'Label alignment',
    labelWidth: 'Label width',
    size: 'Size',
    requiredMark: 'Required mark',
    placeholder: 'Placeholder',
    clearable: 'Clearable',
    showCount: 'Show count',
    maxlength: 'Most characters',
    rows: 'Rows',
    autosize: 'Grow with content',
    min: 'Minimum',
    max: 'Maximum',
    step: 'Step',
    precision: 'Decimals',
    controls: 'Show steppers',
    options: 'Options',
    optionLabel: 'Text',
    optionValue: 'Value',
    multiple: 'Multiple',
    filterable: 'Searchable',
    direction: 'Direction',
    text: 'Text beside it',
    range: 'Pick a range',
    allowHalf: 'Half stars',
    count: 'Stars',
    dateType: 'Unit',
    showAlpha: 'Opacity',
    maxTags: 'Most tags',
    length: 'Digits',
    mask: 'Hide what is typed',
    accept: 'File types',
    maxCount: 'Most files',
    dropzone: 'Drop zone',
    content: 'Content',
    variant: 'Style',
    dashed: 'Dashed',
    tone: 'Tone',
    visibleWhen: 'Show when',
    visibleWhenHelp: 'Shown only while this holds; always shown when left empty',
    disabledWhen: 'Disable when',
    disabledWhenHelp: 'Cannot be filled in while this holds',
    requiredWhen: 'Require when',
    requiredWhenHelp: 'Required while this holds; takes over from “Required” above',
    formula: 'Formula',
    formulaHelp: 'The value is worked out by the formula and cannot be typed',
    addRule: 'Add a rule',
    ruleKind: 'Rule',
    ruleType: 'Format',
    ruleMin: 'Least',
    ruleMax: 'Most',
    ruleRangeHelp: 'Characters for text, items for choices and lists, size for numbers',
    rulePattern: 'Regular expression',
    ruleFlags: 'Flags',
    ruleCheck: 'Expression',
    ruleCheckHelp: 'value is this field’s value and values the whole form; passes when true',
    ruleValidator: 'Validator',
    ruleValidatorHelp: 'Given in code through validators; may ask the server',
    ruleMessage: 'Message on error',
    ruleTrigger: 'Check on',
  },
  choices: {
    layout: { vertical: 'Above', horizontal: 'Beside', inline: 'In a row' },
    labelAlign: { start: 'Start', end: 'End' },
    size: { sm: 'Small', md: 'Medium', lg: 'Large' },
    requiredMark: { true: 'Asterisk', optional: 'Mark optional', false: 'None' },
    direction: { horizontal: 'Across', vertical: 'Down' },
    dateType: {
      date: 'Day',
      week: 'Week',
      month: 'Month',
      quarter: 'Quarter',
      year: 'Year',
      datetime: 'Date and time',
    },
    variant: { title: 'Heading', body: 'Body', caption: 'Caption' },
    ruleKind: {
      type: 'Format',
      range: 'Range',
      pattern: 'Pattern',
      check: 'Expression',
      validator: 'Validator',
    },
    ruleType: {
      email: 'Email',
      url: 'URL',
      number: 'Number',
      integer: 'Whole number',
      string: 'Text',
    },
    ruleTrigger: { auto: 'Default', change: 'Typing', blur: 'Leaving' },
    tone: {
      neutral: 'Neutral',
      primary: 'Primary',
      success: 'Success',
      warning: 'Warning',
      danger: 'Danger',
    },
    breakpoint: { base: 'Narrowest', sm: '≥ 480', md: '≥ 640', lg: '≥ 800', xl: '≥ 960' },
  },
  errors: { name: 'Give the field a name', taken: 'The name “{text}” is taken' },
}

export const formBuilderLocales: Record<string, FormBuilderMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
}

/** Texts to change; each group is merged, so only the texts given are replaced. */
export type FormBuilderMessagesOverride = {
  [K in keyof FormBuilderMessages]?: K extends 'choices'
    ? Record<string, Record<string, string>>
    : Partial<FormBuilderMessages[K]>
}

/** The builder's texts, picked by the name of DouUI's current locale. */
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
    const merged = { ...base } as Record<string, unknown>
    for (const [key, value] of Object.entries(extra)) {
      if (!value) continue
      const own = (base as unknown as Record<string, Record<string, unknown>>)[key]!
      if (key === 'choices') {
        const choices = { ...own } as Record<string, Record<string, string>>
        for (const [setting, labels] of Object.entries(
          value as Record<string, Record<string, string>>,
        ))
          choices[setting] = { ...choices[setting], ...labels }
        merged[key] = choices
      } else merged[key] = { ...own, ...value }
    }
    return merged as unknown as FormBuilderMessages
  })
}
