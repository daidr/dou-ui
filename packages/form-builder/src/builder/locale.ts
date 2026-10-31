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
  }
  /** Read out after a change. */
  announce: {
    inserted: string
    removed: string
    duplicated: string
    moved: string
    wrapped: string
    undone: string
    redone: string
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
  canvas: { label: '表单画布', empty: '点击字段添加到这里' },
  panels: { side: '字段与结构', fields: '字段', outline: '结构', settings: '设置' },
  actions: {
    parent: '选中上一级',
    up: '上移',
    down: '下移',
    duplicate: '复制',
    remove: '删除',
    more: '更多操作',
    wrap: '放进分组',
    addPage: '添加页面',
    undo: '撤销',
    redo: '重做',
  },
  inspector: { form: '表单', multiple: '已选中 {count} 项', type: '组件设置' },
  announce: {
    inserted: '已添加{label}',
    removed: '已删除 {count} 项',
    duplicated: '已复制 {count} 项',
    moved: '已移到第 {index} 位',
    wrapped: '已放进分组',
    undone: '已撤销',
    redone: '已重做',
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
  canvas: { label: '表單畫布', empty: '點選欄位新增到這裡' },
  panels: { side: '欄位與結構', fields: '欄位', outline: '結構', settings: '設定' },
  actions: {
    parent: '選取上一層',
    up: '上移',
    down: '下移',
    duplicate: '複製',
    remove: '刪除',
    more: '更多操作',
    wrap: '放進分組',
    addPage: '新增頁面',
    undo: '復原',
    redo: '重做',
  },
  inspector: { form: '表單', multiple: '已選取 {count} 項', type: '元件設定' },
  announce: {
    inserted: '已新增{label}',
    removed: '已刪除 {count} 項',
    duplicated: '已複製 {count} 項',
    moved: '已移到第 {index} 位',
    wrapped: '已放進分組',
    undone: '已復原',
    redone: '已重做',
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
  canvas: { label: 'Form canvas', empty: 'Click a field to add it here' },
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
    wrap: 'Put in a section',
    addPage: 'Add page',
    undo: 'Undo',
    redo: 'Redo',
  },
  inspector: { form: 'Form', multiple: '{count} selected', type: 'Component' },
  announce: {
    inserted: '{label} added',
    removed: '{count} deleted',
    duplicated: '{count} duplicated',
    moved: 'Moved to position {index}',
    wrapped: 'Put in a section',
    undone: 'Undone',
    redone: 'Redone',
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
