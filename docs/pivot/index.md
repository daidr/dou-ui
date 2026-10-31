---
wide: true
---

# 数据透视

`@dou-ui/pivot` 把一组明细记录按字段分组汇总成交叉表：选择哪些字段作为行、哪些作为列、汇总哪些数值，表格就会算出每个组合的结果，以及各级小计和总计。

透视表只用来分析数据，不修改传入的记录。汇总在内部按列读成紧凑的数字数组后进行，10 万条记录的分组汇总在几十毫秒内完成；只调整排序、展开折叠时不会重新汇总。

## 安装

数据透视是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/pivot
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/pivot/style.css'
import { DouPivot } from '@dou-ui/pivot'

app.use(DouPivot)
```

## 基础用法

`data` 是一组记录，`fields` 说明每个字段的名称和显示方式，`config` 决定字段放在哪里：

- `rows`：放在行上的字段，从外到内逐级分组；
- `columns`：放在列上的字段；
- `values`：要汇总的数值。

<DocDemo src="pivot/basic" />

行上的多个字段显示成一棵树，组所在的行就是这一组的小计；列上的多个字段显示成多级表头，展开的组后面有一列“合计”。最下方的总计行在滚动时始终可见，最右侧是总计列。

`config` 支持 `v-model:config`：在表格里排序时会更新它。它是普通的数据，可以直接保存下来，下次打开时恢复同样的视图。

## 字段面板

`DouPivotFields` 是配套的字段面板：上方列出所有字段，下方是筛选、列、行、值四个区域。把字段拖进区域、在区域里拖动调整顺序、拖回列表移除；勾选字段前的复选框会把它加到合适的位置（数值字段加到值，其他加到行）。面板和表格绑定同一个 `config`：

<DocDemo src="pivot/fields" />

每个字段右侧有两个按钮：漏斗按钮打开筛选，箭头按钮打开菜单，可以调整排序、分组、小计、汇总方式，或者移到其他区域。在手机上，按住字段片刻再拖动；屏幕较窄时，面板收成一个按钮，点击后从底部打开。

## 字段

`fields` 是一个数组，每一项描述一个字段：

```ts
const fields = [
  { name: 'region', label: '大区', order: ['华东', '华南', '华北', '西南'] },
  { name: 'month', label: '月份', format: (m) => `${m} 月` },
  {
    name: 'amount',
    label: '销售额',
    type: 'number',
    format: { style: 'currency', currency: 'CNY' },
  },
  { name: 'profit', label: '毛利', value: (row) => row.amount - row.cost },
]
```

- `name` 是记录上的键，`config` 里用它指代字段；`label` 是表头上显示的名字。
- `type` 可以是 `'string'`、`'number'`、`'date'`、`'boolean'`，不写时根据前 100 条记录推断。
- `format` 决定组名或数值怎么显示：数字字段传 `Intl.NumberFormat` 的选项，日期字段传 `Intl.DateTimeFormat` 的选项，或者传一个函数。
- `order` 指定组的顺序，没有列出的组排在后面。
- `value` 从记录算出字段的值，用来定义记录上没有的字段。

不传 `fields` 时，字段从记录的键推断，表头显示键名。

空值（`null`、`undefined`、空字符串、`NaN`）归为一组，显示为“（空）”，总是排在最后。

## 分组

日期和数字字段可以按区间分组。在行或列上写成对象，用 `by` 指定分组方式：

```ts
const config = {
  rows: [{ field: 'date', by: 'month' }],
  columns: [{ field: 'amount', by: { step: 100 } }],
}
```

- 日期可以按 `'year'`、`'quarter'`、`'month'`、`'week'`、`'day'` 分组，周按 ISO 周计算（周一开始）。
- 数字按 `{ step, start? }` 分成等宽的区间，`start` 默认是 `0`。
- 组名是可以保存的普通数据：年是数字 `2026`，季度、月、周、日是文字 `'2026-Q1'`、`'2026-03'`、`'2026-W12'`、`'2026-03-15'`，区间是它的下限。`filters` 和 `collapsed` 里都用这些组名。

筛选里的组名按这个字段在行或列上的分组来认，例如上面按月分组时写 `{ include: ['2026-03'] }`。字段不在行列上（只放在筛选区域）时，在筛选里写上 `by`，例如 `{ include: ['2026-Q1'], by: 'quarter' }`。在字段面板里改变分组时，这个字段的筛选会被清空。

## 汇总方式

`values` 的每一项可以是字段名，也可以是一个对象：

```ts
values: [
  'amount', // 数字字段默认求和，其他字段默认计数
  { field: 'amount', aggregate: 'avg', label: '客单价' },
  { aggregate: 'count', label: '订单数' }, // 不写 field：数记录的条数
]
```

内置的汇总方式：

| 名称       | 说明                   |
| ---------- | ---------------------- |
| `sum`      | 求和                   |
| `count`    | 计数：非空值的个数     |
| `avg`      | 平均值                 |
| `min`      | 最小值                 |
| `max`      | 最大值                 |
| `distinct` | 去重计数：不同值的个数 |
| `median`   | 中位数                 |

`values` 为空时显示一列“计数”，统计每组有多少条记录。

求和的表头就是字段名，其他方式写成“字段 · 方式”，比如“销售额 · 平均值”。`label` 可以改成别的文字，`format` 可以单独指定这一项的显示格式，不写时用字段的 `format`。

### 多个值

有多个值时，默认放在列上，每个列组下面各有一列；`valuesOn: 'rows'` 把它们放到行上，每个行组占几行。只有一个值时，值的名称只在左上角显示一次，不在每一列下面重复。

<DocDemo src="pivot/values" />

### 自定义汇总方式

`defineAggregator` 定义新的汇总方式，通过 `aggregators` 传给表格，`config` 里用它的 `name` 引用：

<DocDemo src="pivot/aggregator" />

- `init` 创建一个组的初始状态，`add` 把一条记录的值加进状态，`result` 从状态算出显示的数字。
- `merge` 把两个组的状态合并成一个。小计和总计由内层各组的状态合并而来，不会再逐条读取记录，所以 `merge` 必须得到和逐条 `add` 一样的结果。
- `input` 默认是 `'number'`，`add` 收到的是数字，没有数字的记录会跳过；设为 `'value'` 时收到字段的原始值，空值跳过。

## 布局

默认的紧凑式布局把行上的字段放在同一列里，缩进成一棵树，组所在的行就是它的小计。`layout="tabular"` 改成表格式：每个行字段单独一列，组名只在这一组的第一行显示，展开的组在子项后面另起一行“小计”。

<DocDemo src="pivot/layout" />

拖动列标题的右边缘可以调整列宽，双击右边缘按内容调整；左上角的右边缘调整行头的宽度，双击恢复。不需要时设置 `:resizable="false"`。

## 展开与折叠

点击组名或前面的箭头可以展开、折叠这一组，按住 Alt 点击会同时切换同一层的所有组。列上的组在表头里同样可以展开折叠。折叠的组只占一行或一列，显示这一组的合计。

`v-model:collapsed` 记录折叠了哪些组，每个组用它从外到内的组名表示。记录的是“折叠了哪些”而不是“展开了哪些”，所以数据变化后新出现的组默认是展开的。

<DocDemo src="pivot/collapse" />

通过 ref 还可以调用：

| 方法                             | 说明                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `expandAll({ axis? })`           | 展开所有组，`axis` 是 `'rows'` 或 `'columns'`，不写时两个方向都展开          |
| `collapseAll({ axis?, depth? })` | 折叠从第 `depth` 层开始的所有组，`depth` 默认 1，即只显示最外层；`axis` 同上 |
| `toggle(axis, path, open?)`      | 展开或折叠一个组                                                             |

```ts
pivot.value.collapseAll({ axis: 'rows', depth: 2 }) // 行上只展开到第 2 层
```

## 排序

行上的组默认按组名升序排列：中文按拼音，数字按大小，字段的 `order` 优先。点击左上角的字段名切换这一层的升序和降序，也可以在 `rows` 里写 `{ field: 'city', sort: 'desc' }`。

点击值的表头按这一列的数值排序：第一次从大到小，第二次从小到大，第三次恢复按组名排序。每一层的组在各自的上级里排序。按数值排序记录在 `config.sort` 里：

```ts
sort: { valueIndex: 0, column: ['Q4'], order: 'desc' } // 按 Q4 那一列的第 1 个值降序
```

`valueIndex` 是值在 `values` 里的序号，`column` 是列组的组名，`[]` 表示总计列。

## 筛选

`filters` 按字段保留或排除一些组，排除的记录不参与任何汇总：

```ts
filters: {
  channel: { exclude: ['外卖'] },
  region: { include: ['华东', '华南'] },
}
```

没有记录通过筛选时，表格中间显示“没有数据”。

## 查看明细

点击一个数字（或用方向键选中后按 Enter）会触发 `cell-click`，参数里有这一格的行组、列组、值的序号和数值。`records()` 返回汇总进这一格的记录，`indices()` 返回它们在 `data` 里的下标。

<DocDemo src="pivot/details" />

## 总计

`totals: { rows: false }` 去掉底部的总计行，`totals: { columns: false }` 去掉右侧的总计列。行或列上的某个字段不需要小计时，写成 `{ field: 'city', subtotal: false }`：行上展开的组不再显示数字，列上的组后面不再有“合计”列。

## 大量数据

下面的表格有 10 万条记录，可以切换到 100 万条。

<DocDemo src="pivot/large" />

表格只渲染视口里看得到的行和列，滚动时不会重新计算。汇总时每个字段只读取一次，读成数字数组后缓存，之后调整布局只读取新用到的字段。使用大量数据时：

- 把数据放在 `shallowRef` 里，或用 `markRaw` 标记，避免 Vue 为每一条记录创建响应式代理。
- 更新时替换整个数组，不要原地修改：缓存按数组本身区分，原地修改的数组不会重新读取。
- `fields` 写在 `script` 里而不是模板里，模板里的数组每次渲染都是新的，会让字段重新读取。

## 键盘

表格可以聚焦，方向键移动选中的格子；在组名上按 → 展开、按 ← 折叠或回到上一级，Enter 或空格切换展开。Page Up / Page Down 翻页，Home / End 跳到行首、行尾，加上 Ctrl 或 ⌘ 跳到第一行、最后一行。

## 不用组件

汇总的内核可以单独使用，比如在服务端或 worker 里：

```ts
import { computePivot, PivotSource } from '@dou-ui/pivot/engine'

const source = new PivotSource(orders, { fields })
const result = computePivot(source, { rows: ['region'], values: ['amount'] })

const east = result.rows.find(['华东'])
result.get(east, result.columns.total) // 华东的销售额（列上的总计）
result.get(east, result.columns.find(['Q1']), 1) // 华东 Q1 的第 2 个值
```

同一个 `PivotSource` 可以反复计算不同的布局，已经读过的字段不会再读。

## API

### Pivot Props

| 名称               | 说明                                             | 类型                     | 默认值         |
| ------------------ | ------------------------------------------------ | ------------------------ | -------------- |
| `data`             | 记录                                             | `object[]`               | —              |
| `fields`           | 字段的说明                                       | `PivotField[]`           | 从记录的键推断 |
| `config`           | 字段放在哪里，支持 `v-model:config`              | `PivotConfig`            | `{}`           |
| `collapsed`        | 折叠的组，支持 `v-model:collapsed`               | `PivotCollapsed`         | `{}`           |
| `max-height`       | 最大高度，数字按 px 计算；内容更少时随内容变矮   | `number \| string`       | `480`          |
| `size`             | 行高：28、32、40px                               | `'sm' \| 'md' \| 'lg'`   | `'md'`         |
| `row-header-width` | 行头的宽度（px），窄屏上会自动收窄               | `number`                 | `200`          |
| `column-width`     | 每个数值列的最小宽度（px），表格较宽时会适当加宽 | `number`                 | `120`          |
| `layout`           | 紧凑式或表格式布局                               | `'compact' \| 'tabular'` | `'compact'`    |
| `resizable`        | 能否拖动调整列宽                                 | `boolean`                | `true`         |
| `aggregators`      | 自定义的汇总方式                                 | `PivotAggregator[]`      | —              |
| `aria-label`       | 读屏读出的名称                                   | `string`                 | `'数据透视表'` |
| `messages`         | 替换语言包里的文字                               | `PivotMessagesOverride`  | —              |

### PivotFields Props

| 名称          | 说明                                            | 类型                    | 默认值         |
| ------------- | ----------------------------------------------- | ----------------------- | -------------- |
| `data`        | 记录，和表格传同一份                            | `object[]`              | —              |
| `fields`      | 字段的说明，和表格传同一份                      | `PivotField[]`          | 从记录的键推断 |
| `config`      | 字段放在哪里，支持 `v-model:config`             | `PivotConfig`           | `{}`           |
| `aggregators` | 自定义的汇总方式，会出现在值的菜单里            | `PivotAggregator[]`     | —              |
| `drawer`      | 是否收成按钮、从底部打开；`'auto'` 在窄屏上收起 | `boolean \| 'auto'`     | `'auto'`       |
| `messages`    | 替换语言包里的文字                              | `PivotMessagesOverride` | —              |

### Pivot Events

| 名称               | 说明                       | 参数             |
| ------------------ | -------------------------- | ---------------- |
| `update:config`    | 在表格里排序时             | `PivotConfig`    |
| `update:collapsed` | 展开或折叠组时             | `PivotCollapsed` |
| `cell-click`       | 点击数字，或选中后按 Enter | `PivotCellEvent` |

### PivotCellEvent

| 名称         | 说明                              | 类型             |
| ------------ | --------------------------------- | ---------------- |
| `row`        | 行组从外到内的组名，总计行为 `[]` | `unknown[]`      |
| `column`     | 列组从外到内的组名，总计列为 `[]` | `unknown[]`      |
| `valueIndex` | 值在 `config.values` 里的序号     | `number`         |
| `value`      | 格子里的数值，空格子为 `NaN`      | `number`         |
| `records`    | 汇总进这一格的记录                | `() => object[]` |
| `indices`    | 这些记录在 `data` 里的下标        | `() => number[]` |

### PivotConfig

| 名称       | 说明                     | 类型                                                        | 默认值      |
| ---------- | ------------------------ | ----------------------------------------------------------- | ----------- |
| `rows`     | 行上的字段               | `(string \| { field, sort?, subtotal?, by? })[]`            | `[]`        |
| `columns`  | 列上的字段               | `(string \| { field, sort?, subtotal?, by? })[]`            | `[]`        |
| `values`   | 要汇总的值               | `(string \| { field?, aggregate?, label?, format? })[]`     | 计数        |
| `filters`  | 按字段保留或排除组       | `Record<string, { include?, exclude?, by? }>`               | —           |
| `valuesOn` | 多个值放在哪个方向       | `'columns' \| 'rows'`                                       | `'columns'` |
| `sort`     | 按某一列的数值给行组排序 | `{ valueIndex: number, column?: unknown[], order } \| null` | —           |
| `totals`   | 总计行和总计列           | `{ rows?: boolean, columns?: boolean }`                     | 都显示      |

### CSS 变量

| 变量                      | 说明                   |
| ------------------------- | ---------------------- |
| `--dou-pivot-line`        | 格子之间的线           |
| `--dou-pivot-line-strong` | 表头、行头的分隔线     |
| `--dou-pivot-head-bg`     | 表头和总计行的背景     |
| `--dou-pivot-total-bg`    | 合计列和总计列的背景   |
| `--dou-pivot-ring`        | 键盘选中格子的边框颜色 |

### 读屏

表格是一个树形网格（`role="treegrid"`）：每行带有层级（`aria-level`），组所在的行带有展开状态（`aria-expanded`），排序中的表头带有 `aria-sort`。用方向键移动时，读屏读出选中的格子。
