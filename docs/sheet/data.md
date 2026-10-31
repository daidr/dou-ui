# 文档数据

电子表格的数据是一个工作簿，用 `v-model` 绑定。它是普通的 JSON，可以直接存储和传输。

```ts
interface SheetWorkbook {
  sheets: SheetData[]
  styles?: Record<string, SheetStyle> // 命名样式，单元格按名字引用
}
```

## 工作表

```ts
interface SheetData {
  name: string // 工作表的名字，在工作簿里唯一
  cells: (SheetCellInput[] | null)[] // 按行排列的单元格
  rowCount?: number // 行数，默认 1000，至少能放下 cells
  colCount?: number // 列数，默认 26，至少能放下最宽的一行
  rowSizes?: Record<number, number> // 改过的行高，按行号；0 表示隐藏
  colSizes?: Record<number, number> // 改过的列宽，按列号；0 表示隐藏
  freeze?: { rows?: number; cols?: number } // 冻结的行数、列数
}
```

`cells` 是二维数组，`cells[0][1]` 是第 1 行第 2 列，也就是 `B1`。空行、空单元格可以留空（`null` 或不写），数组只需要写到有数据的地方。行号、列号都从 0 开始，`columnName(1)` 得到 `B`，`parseCell('B1')` 得到 `{ row: 0, col: 1 }`。

用二维数组而不是 `{ A1: ... }` 这样的键值表，是为了修改快：每次修改只复制改动的那一行和外层数组，其余行原样共享。表格靠比较行数组是否相同来判断哪些行要重新绘制。

## 单元格

```ts
type SheetValue = string | number | boolean | null

type SheetCellInput = SheetValue | SheetCell

interface SheetCell {
  value?: SheetValue
  style?: string // 样式的名字
  format?: string // 数字或日期格式
  note?: string // 备注
}
```

只有值的单元格直接写值：`['苹果', 3, true]`。需要样式或格式时写成对象：`{ value: 1800, format: '¥#,##0' }`。表格写回数据时也是这样，没有其他字段的单元格会写成值本身。

以 `=` 开头的字符串是公式。日期用 `'YYYY-MM-DD'` 或 `'YYYY-MM-DD HH:mm'` 字符串，和 DouUI 其他日期组件一致。

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
| `#,##0;(#,##0)` | `1,235`         | 分号后面是负数的格式，`-3` 显示为 `(3)` |
| `@`             | `1234.5`        | 按文字显示                              |

日期格式用于日期字符串：`yyyy` 年，`m` / `mm` 月，`d` / `dd` 日，`h` / `hh` 时，`mm` 跟在时后面表示分，`ss` 秒。例如 `'2026-03-05'` 用 `m月d日` 显示为 `3月5日`，用 `yyyy/m/d` 显示为 `2026/3/5`。

没有格式的数字最多显示 15 位有效数字，`0.1 + 0.2` 显示为 `0.3`。

`formatValue(value, format)` 和 `parseInput(text)` 也可以单独使用，比如在导出时得到和表格里一样的文字。

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
}
```

样式定义在工作簿的 `styles` 里，单元格用名字引用，同一种样式只存一份：

```ts
const book = {
  styles: { head: { bold: true, fill: 'neutral' }, warn: { tone: 'danger' } },
  sheets: [{ name: '表 1', cells: [[{ value: '项目', style: 'head' }]] }],
}
```

`tone` 和 `fill` 用主题的语义色，会跟着亮色、暗色模式变化；`color` 和 `background` 原样使用，暗色模式下需要自己留意对比度。

## 选区

```ts
interface SheetSelection {
  active: { row: number; col: number } // 键盘所在的单元格
  ranges: { start: { row: number; col: number }; end: { row: number; col: number } }[]
}
```

`start` 是开始选择的位置，`end` 是拖到的位置，`end` 可以在 `start` 的上方或左边；`boundsOf(range)` 得到排好顺序的 `top`、`left`、`bottom`、`right`。选区不属于数据，不会写进工作簿。
