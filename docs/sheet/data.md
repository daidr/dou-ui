# 文档数据

电子表格的数据是一个工作簿，用 `v-model` 绑定。它是普通的 JSON，可以直接存储和传输。

```ts
interface SheetWorkbook {
  version: 1 // 数据格式的版本
  sheets: SheetData[]
  styles?: Record<string, SheetStyle> // 命名样式，单元格按名字引用
  types?: Record<string, SheetTypeSetup> // 命名单元格类型设置，单元格的 type 按名字引用
  protect?: boolean // 保护工作簿结构：不能添加、删除、移动或重命名工作表
}
```

## 工作表

```ts
interface SheetData {
  id?: string // 稳定的标识，修改步骤和协作用它找到工作表；不写时用 name
  name: string // 工作表的名字，在工作簿里唯一
  cells: (SheetCellInput[] | null)[] // 按行排列的单元格
  rowCount?: number // 行数，默认 1000，至少能放下 cells
  colCount?: number // 列数，默认 26，至少能放下最宽的一行
  rowSizes?: Record<number, number> // 改过的行高，按行号；0 表示隐藏
  colSizes?: Record<number, number> // 改过的列宽，按列号；0 表示隐藏
  freeze?: { rows?: number; cols?: number } // 冻结的行数、列数
  merges?: string[] // 合并的区域，如 'A1:C1'
  filter?: SheetFilter // 筛选
  conditionalFormats?: SheetConditionalFormat[] // 条件格式，排在前面的优先
  validations?: SheetValidation[] // 数据验证，排在前面的优先
  protect?: boolean | SheetProtection // 保护工作表，见下文
}
```

`protect` 为 `true` 时，工作表里锁定的单元格、行列和规则都不能修改；写成对象时可以放开其中几项：

```ts
interface SheetProtection {
  formatCells?: boolean // 修改锁定单元格的样式和数字格式，合并单元格
  formatColumns?: boolean // 修改列宽、隐藏列
  formatRows?: boolean // 修改行高、隐藏行
  insertRows?: boolean
  insertColumns?: boolean
  deleteRows?: boolean
  deleteColumns?: boolean
  filter?: boolean // 用筛选决定显示哪些行；排序会移动单元格，只能排未锁定的
}
```

单元格默认是锁定的，样式里写 `locked: false` 的单元格不锁定，见[保护](./#保护)。

工作表可能在修改同步过来之前被改名（比如多人协作时），这时应该给工作表一个不会变的 `id`。

`cells` 是二维数组，`cells[0][1]` 是第 1 行第 2 列，也就是 `B1`。空行、空单元格可以留空（`null` 或不写），数组只需要写到有数据的地方。行号、列号都从 0 开始，`columnName(1)` 得到 `B`，`parseCell('B1')` 得到 `{ row: 0, col: 1 }`。

用二维数组而不是 `{ A1: ... }` 这样的键值表，是为了修改快：每次修改只复制改动的那一行和外层数组，其余行原样共享。表格靠比较行数组是否相同来判断哪些行要重新绘制。

## 筛选

```ts
interface SheetFilter {
  range: string // 筛选的区域，第一行是表头，如 'A1:G25'
  columns?: Record<number, SheetFilterRule> // 各列的筛选条件，按列号
  sorted?: { col: number; order: 'asc' | 'desc' } // 最近一次从筛选按钮排序的列
}

type SheetFilterRule =
  | { values: string[] } // 显示文字是其中之一的行留下，空单元格是 ''
  | { condition: SheetCondition }

interface SheetCondition {
  op:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'ge'
    | 'lt'
    | 'le'
    | 'between'
    | 'notBetween'
    | 'contains'
    | 'notContains'
    | 'begins'
    | 'ends'
    | 'blank'
    | 'notBlank'
  value?: SheetValue
  to?: SheetValue // between 和 notBetween 的另一端，两端都包含
}
```

`values` 按单元格显示的文字比较，所以设了格式的数字写显示出来的样子，比如 `'¥1,280'`。插入、删除、移动行列时，筛选区域和各列的条件跟着移动。

在表格之外处理同样的数据时，可以用包里导出的 `sortRows`、`compareForSort`、`meetsRule` 和 `textCollator`，排序和筛选的结果与表格里一致。

## 条件格式

```ts
type SheetConditionalFormat = (
  | { when: SheetCondition; style: string | SheetStyle } // 满足条件
  | { formula: string; style: string | SheetStyle } // 公式为真，按左上角单元格书写
  | { top: number; percent?: boolean; style: string | SheetStyle } // 最大的几个
  | { bottom: number; percent?: boolean; style: string | SheetStyle } // 最小的几个
  | { average: 'above' | 'below'; style: string | SheetStyle } // 高于或低于平均值
  | { duplicates: true; style: string | SheetStyle } // 重复值
  | { unique: true; style: string | SheetStyle } // 唯一值
  | { scale: [SheetColor, SheetColor] | [SheetColor, SheetColor, SheetColor] } // 色阶
  | { bar: true | SheetColor } // 数据条，true 用中性色
) & { range: SheetRuleRange }

type SheetRuleRange = string | string[] // 一个区域，或几个区域
type SheetColor = Tone | string // 主题的语义色名，或任意 CSS 颜色
```

`range` 可以是 `'D2:D40'` 这样的区域，也可以是整列 `'D:D'`、整行 `'2:2'`，或者几个区域组成的数组，如 `['D2:D40', 'G2:G40']`。几个区域当作一个整体：最大最小、平均值、重复值、色阶和数据条按所有区域一起计算，公式按第一个区域的左上角单元格书写。`style` 写样式或 `styles` 里的样式名。`top`、`bottom`、`average`、`scale`、`bar` 只看数字，文字和空单元格不参与计算；`duplicates`、`unique` 按显示的文字比较，不区分大小写，空单元格不算。色阶用最小值、中位数（三种颜色时）和最大值定位颜色。

## 数据验证

```ts
type SheetValidation = (
  | { list: SheetSelectOption[] | string } // 列表：选项，或引用单元格，如 '=$G$2:$G$5'
  | { when: SheetCondition; integer?: boolean } // 满足条件；条件里是数字时要求数字
  | { formula: string } // 公式为真，按左上角单元格书写
) & {
  range: SheetRuleRange // 写法同条件格式
  strict?: boolean // 输入不符合时拒绝，默认 true
  message?: string // 不符合时的提示
  prompt?: string // 选中时的提示
}
```

`integer` 写在条件外面，是因为 `SheetCondition` 和筛选、条件格式共用，那里没有“必须是整数”的说法。一个单元格被多条规则覆盖时，用排在前面的那条。列表的选项按值比较，文字不区分大小写；引用的单元格里的空值和重复值会去掉，最多读 1000 行。

## 单元格

```ts
type SheetValue = string | number | boolean | null

type SheetCellInput = SheetValue | SheetCell

interface SheetCell {
  value?: SheetValue
  style?: string // 样式的名字
  format?: string // 数字或日期格式
  note?: string // 批注
  type?: string // 单元格类型：date、select、checkbox、扩展加的类型，或 types 里的名字
  link?: string // 链接：https、http、mailto、tel 地址，或 # 加单元格引用，如 '#汇总!B2'
}
```

只有值的单元格直接写值：`['苹果', 3, true]`。需要样式或格式时写成对象：`{ value: 1800, format: '¥#,##0' }`。表格写回数据时也是这样，没有其他字段的单元格会写成值本身。合并单元格、单元格类型和链接见[介绍](./#合并单元格)。

以 `=` 开头的字符串是公式。要存以 `=` 开头的文字，写成 `'=…`，单元格里显示时不带 `'`；在单元格里输入 `'=abc` 也是这样存的。日期用 `'YYYY-MM-DD'` 或 `'YYYY-MM-DD HH:mm'` 字符串，时间用 `'HH:mm'` 或 `'HH:mm:ss'` 字符串，和 DouUI 其他日期组件一致。

## 数字与日期格式

`format` 只影响显示，值保持原样。

| 格式            | `1234.5` 显示为 | 说明                                    |
| --------------- | --------------- | --------------------------------------- |
| `0`             | `1235`          | 整数                                    |
| `0.00`          | `1234.50`       | 固定两位小数                            |
| `0.##`          | `1234.5`        | 最多两位小数，末尾的 0 不显示           |
| `#,##0`         | `1,235`         | 千分位                                  |
| `¥#,##0.00`     | `¥1,234.50`     | 前后可以加符号                          |
| `0"件"`         | `1235件`        | 引号里的文字原样显示                    |
| `0%`            | `123450%`       | 乘以 100 加百分号                       |
| `0\h`           | `1235h`         | `\` 后面的一个字符原样显示              |
| `#,##0;(#,##0)` | `1,235`         | 分号后面是负数的格式，`-3` 显示为 `(3)` |
| `0;(0);"-"`     | `1235`          | 第三段是 0 的格式，`0` 显示为 `-`       |
| `@`             | `1234.5`        | 按文字显示                              |

数字格式最多三段，依次用于正数、负数和 0。负数段里不显示负号；没有数字占位符的段（如 `"-"`）直接显示其中的文字。

日期格式用于日期和时间字符串：

| 符号           | 含义                       | `'2026-03-05 09:07:08'` 显示为 |
| -------------- | -------------------------- | ------------------------------ |
| `yyyy` / `yy`  | 年                         | `2026` / `26`                  |
| `m` / `mm`     | 月                         | `3` / `03`                     |
| `d` / `dd`     | 日                         | `5` / `05`                     |
| `ddd` / `dddd` | 星期，按当前语言           | `周四` / `星期四`              |
| `h` / `hh`     | 时                         | `9` / `09`                     |
| `m` / `mm`     | 紧跟在时后面或秒前面时是分 | `7` / `07`                     |
| `s` / `ss`     | 秒                         | `8` / `08`                     |

其他字符原样显示，比如 `yyyy年m月d日`。和符号冲突的文字放在引号里，或在前面加 `\`，例如 `yyyy-mm-dd "(d)"`。时间字符串只能用时、分、秒，用到年月日的格式时按原样显示。例如 `'2026-03-05'` 用 `m月d日 ddd` 显示为 `3月5日 周四`，`'09:30'` 用 `h:mm` 显示为 `9:30`。

没有格式的数字最多显示 15 位有效数字，`0.1 + 0.2` 显示为 `0.3`。

`formatValue(value, format, locale)` 和 `parseInput(text)` 也可以单独使用，`locale` 决定星期的语言，比如在导出时得到和表格里一样的文字。

## 样式

```ts
interface SheetStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' // 文字颜色
  fill?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' // 浅色底
  color?: string // 任意 CSS 颜色，优先于 tone
  background?: string // 任意 CSS 颜色，优先于 fill
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  wrap?: boolean // 自动换行
  locked?: boolean // 写 false 时，工作表受保护后这些单元格仍然可以编辑
}
```

样式定义在工作簿的 `styles` 里，单元格用名字引用，同一种样式只存一份：

```ts
const book = {
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' }, warn: { tone: 'danger' } },
  sheets: [{ name: '表 1', cells: [[{ value: '项目', style: 'head' }]] }],
}
```

`tone` 和 `fill` 用主题的语义色，会跟着亮色、暗色模式变化；`color` 和 `background` 原样使用，暗色模式下需要自己留意对比度。

## 检查与迁移

工作簿里的 `version` 是数据格式的版本，目前是 `1`。保存或打开一份工作簿之前，可以先检查：

```ts
import { checkWorkbook, migrateWorkbook } from '@dou-ui/sheet'

const book = migrateWorkbook(JSON.parse(saved))
const problems = checkWorkbook(book, { extensions })
```

`checkWorkbook` 找出版本不对、工作表没有名字或重名、`id` 重复、单元格用了没有定义的样式或类型，以及写错或互相重叠的合并区域，每一项带 `code`、`path`（如 `sheets[0].cells[3][2]`）和出问题的工作表名 `sheet`。扩展加入的单元格类型要传入同样的 `extensions` 才认得。整份数据的形状不对（不是对象，或者列表不是数组）时只报 `shape`，先修好形状才能检查别的。`migrateWorkbook` 补全旧数据或手写数据缺少的部分（`version`、`sheets`、每张表的 `cells`），丢掉不是对象的工作表；传入的不是对象（包括数组和 `null`），或者版本不认识时报错，以免把损坏的存档当成空工作簿再保存回去。还没有存档时用 `emptyWorkbook()` 新建。这几个函数也可以从不含组件的 `@dou-ui/sheet/core` 引入。

`version` 的类型是字面量 `1`，在 TypeScript 里手写工作簿时给 `ref` 标上 `SheetWorkbook` 类型，或写成 `version: 1 as const`。`v-model` 的形状不对（缺少 `sheets` 或 `version`）时，表格把缺少的部分当成空的，并在开发环境下给出警告；写回的工作簿总是带 `version: 1`。

## 选区

```ts
interface SheetSelection {
  active: { row: number; col: number } // 键盘所在的单元格
  ranges: { start: { row: number; col: number }; end: { row: number; col: number } }[]
}
```

`start` 是开始选择的位置，`end` 是拖到的位置，`end` 可以在 `start` 的上方或左边；`boundsOf(range)` 得到排好顺序的 `top`、`left`、`bottom`、`right`。选区不属于数据，不会写进工作簿。
