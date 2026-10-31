---
wide: true
---

# 数据透视

`@dou-ui/pivot` 把一组明细记录按字段分组汇总成交叉表：选择哪些字段作为行、哪些作为列、汇总哪些数值，表格就会算出每个组合的结果，以及各级小计和总计。

透视表只用来分析数据，不修改传入的记录。汇总在内部按列读成紧凑的数字数组后进行，10 万条记录的分组汇总在几十毫秒内完成；只调整排序、展开折叠时不会重新汇总。

几个完整页面的写法见区块中的[销售分析](../blocks/sales-analysis)和[工单统计](../blocks/ticket-stats)。

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

### 显示方式

`show` 把值换一种方式显示：占比、与前一组的差值、累计或排名。汇总的结果不变，只是显示的数字不同：

<DocDemo src="pivot/show" />

| `show`              | 显示                                         |
| ------------------- | -------------------------------------------- |
| `percentOfTotal`    | 占总计的百分比                               |
| `percentOfRow`      | 占这一行合计的百分比                         |
| `percentOfColumn`   | 占这一列合计的百分比                         |
| `percentOfParent`   | 占上一级组的百分比                           |
| `difference`        | 与前一组的差值，第一组为空                   |
| `percentDifference` | 与前一组相差的百分比                         |
| `runningTotal`      | 从第一组加到这一组的累计                     |
| `rank`              | 在同一级的组里的排名，最大的为 1，总计不排名 |

“前一组”“同一级”看的是一个方向（`axis`）上的组：差值和累计默认沿列，即和左边一列的组比较、从左往右累加（比如按季度和上一季度比较）；占上一级和排名默认沿行，即和上一级的行组相比、在同一级的行组里排名。这个方向上没有字段时换到另一个方向。要指定方向，写成对象：

```ts
{ field: 'amount', show: { as: 'difference', axis: 'rows' } } // 和上一行的组比较
```

组的先后按组名的顺序，不受按数值排序的影响。百分比默认保留一位小数，差值带正负号；`format` 可以另外指定。表头会在值的名称后面加上显示方式，比如“销售额 · 占行合计”。`cell-click` 的 `value` 是显示的数字。

### 计算值

`formula` 用已有的字段算出新的值，比如每杯的均价：

<DocDemo src="pivot/formula" />

公式里的字段名（或字段的 `label`）表示这个字段在这一格的合计，所以小计和总计里算的是“合计之比”，而不是把各组的比值相加。可以用：

- 数字、`+ - * /` 和括号；
- `sum(字段)`、`avg(字段)`、`min(字段)`、`max(字段)`、`count(字段)`（非空的个数）和 `count()`（记录的条数）；
- 方括号括起有空格或符号的字段名，如 `[unit price]`。

除以 0 的格子留空。公式只做解析和计算，不会执行任何代码。字段面板的“添加计算值”可以在界面里写公式，写错时会指出原因。`parsePivotFormula` 和 `checkPivotFormula` 可以在别处检查公式，错误是 `PivotFormulaError`，`code` 说明原因。

### 条件格式

`mark` 按数值给格子上色：`'bar'` 在数字下面画一条数据条，`'scale'` 按大小给格子铺上深浅不同的底色。颜色默认是中性色，`{ type: 'scale', tone: 'success' }` 可以换成别的语气色：

<DocDemo src="pivot/mark" />

上色的只有最内层的格子，小计和总计不上色，最小值和最大值也只在这些格子里找。有负数时，数据条从 0 开始向两边画。

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

`top` 按合计保留最大（或最小）的几组，`between` 保留合计在某个范围里的组：

```ts
filters: {
  city: { top: { count: 10 } }, // 销售额最高的 10 个城市
  category: { top: { count: 3, valueIndex: 1, order: 'asc' } }, // 按第 2 个值，最小的 3 个
  region: { between: { min: 10000 } },
}
```

合计按 `values` 里第 `valueIndex` 个值（默认第一个）计算，统计的是经过 `include` / `exclude` 筛选后的记录，被排除的组不参与总计。字段面板里，行和列上字段的菜单有“前 N 项”，选“自定义…”可以填任意项数，或者按合计范围筛选。

没有记录通过筛选时，表格中间显示“没有数据”。

## 查看明细

点击一个数字（或用方向键选中后按 Enter）会触发 `cell-click`，参数里有这一格的行组、列组、值的序号和数值；`row` 和 `column` 是组的原始值（日期按月分组时是 `'2026-01'`），`labels` 是表格里写出的文字。`records()` 返回汇总进这一格的记录，`indices()` 返回它们在 `data` 里的下标。下面的例子在抽屉里用表格列出这些订单：

<DocDemo src="pivot/details" />

`records()` 和 `indices()` 在调用时才去查找记录，点击本身不会多花时间。总计格子包含所有记录，数据量大时列表要用虚拟滚动，例子里的表格加了 `virtual`。

## 复制与导出

### 选择与复制

用鼠标在格子上拖动，或者按住 Shift 点击、按 Shift + 方向键，可以选中一片格子；Ctrl / ⌘ + A 选中全部，Esc 取消。按 Ctrl / ⌘ + C 复制，剪贴板里同时有两种内容：

- 用制表符分隔的文字，数字按表格里显示的样子写，粘到文本编辑器里也能对齐；
- 一张 HTML 表格，粘到电子表格软件里，每个数字占一格。粘到 [`DouSheet`](/sheet/) 里时，数字保留原来的值和格式（比如占比仍然是 `0.213`，显示为 `21.3%`），总计行是粗体。

选中的范围包括行头时，每个行字段各占一列。全选后复制会带上列的表头。手机上拖动用来滚动表格，不会选中格子。

通过 ref 调用 `copy()` 复制选中的格子，`copy({ all: true })` 复制整张表。

### 导出

表格通过 ref 提供几种导出方式，导出的都是当前看到的样子：折叠的组只有一行，显示方式、排序和筛选都和表格一致。导出时每个行字段占一列，和表格式布局一样。

<DocDemo src="pivot/export" />

| 方法                    | 结果                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `toCSV(options?)`       | CSV 文字。默认写数值（`1280`、`0.213`），`{ text: true }` 写显示的文字（`¥1,280`、`21.3%`） |
| `toSheet({ name? })`    | 给 `DouSheet` 的工作簿：数字带格式，表头合并并冻结，列宽和屏幕上一样                        |
| `toChartRows(options?)` | 给 `@dou-ui/chart` 的行数据和系列，见下面的透视图                                           |
| `toGrid()`              | 每个格子的文字、数值和类型，用来自己生成别的格式                                            |
| `print(options?)`       | 打开浏览器的打印对话框，打印整张表                                                          |

数值去掉了汇总时的浮点误差（按 15 位有效数字取整，`1592.0200000000002` 写成 `1592.02`）。CSV 默认以字节顺序标记开头，这样电子表格软件能按 UTF-8 打开，`{ bom: false }` 可以去掉。组名以 `=`、`+`、`-`、`@` 开头时，前面会加上 `'`，防止在电子表格里被当成公式运行。

### 转成电子表格

`toSheet()` 返回的对象可以直接作为 `DouSheet` 的 `v-model`，之后可以在表格里继续编辑、加公式。两个包互不依赖，各自单独安装。

<DocDemo src="pivot/sheet" />

### 透视图

`toChartRows()` 返回 `{ x, rows, series }`：每个没有展开的行组是一行（展开的组换成它的子组），每个列组是一个系列，小计和总计不在里面。把 `rows` 交给图表的 `data`、`x` 交给 `x`，再为每个系列放一个柱子或折线：

```vue
<DouChart :data="chart.rows" :x="chart.x">
  <DouChartAxis for="y" :format="chart.series[0]?.format" />
  <DouChartBar v-for="s in chart.series" :key="s.key" :y="s.key" :name="s.name" stack />
</DouChart>
```

每个系列还带有 `valueIndex` 和 `format`：`format` 按表格的写法写出数字，交给坐标轴的 `format`，刻度就和表格一致（`¥10,000`）。空格子是 `null`，图表里会断开。没有数据时返回 `{ x: 'label', rows: [], series: [] }`。

在 `computed` 里调用 `toChartRows()`，表格展开、折叠或换了字段时图会跟着更新。有多个值时，`{ valueIndex }` 只取其中一个。

<DocDemo src="pivot/chart" />

### 打印

表格只渲染看得到的部分，直接打印页面只能打出一屏。`print()` 把整张表写成普通的表格再打印：纸张是 A4，表格比竖向的纸宽时自动横向，列的表头在每一页重复。`title` 是表格上方的标题，默认用 `aria-label`；`orientation` 可以指定 `'portrait'` 或 `'landscape'`。

## 总计

`totals: { rows: false }` 去掉底部的总计行，`totals: { columns: false }` 去掉右侧的总计列。行或列上的某个字段不需要小计时，写成 `{ field: 'city', subtotal: false }`：行上展开的组不再显示数字，列上的组后面不再有“合计”列。

## 大量数据

下面的表格有 10 万条记录，可以切换到 100 万条。

<DocDemo src="pivot/large" />

表格只渲染视口里看得到的行和列，滚动时不会重新计算。汇总时每个字段只读取一次，读成数字数组后缓存，之后调整布局只读取新用到的字段。使用大量数据时：

- 把数据放在 `shallowRef` 里，或用 `markRaw` 标记，避免 Vue 为每一条记录创建响应式代理。
- 更新时替换整个数组，不要原地修改：缓存按数组本身区分，原地修改的数组不会重新读取。
- `fields` 写在 `script` 里而不是模板里，模板里的数组每次渲染都是新的，会让字段重新读取。

### 按列给出数据

`data` 也可以按列给出：每个字段一个数组，数字可以用类型化数组。百万条记录用这种形式，内存只有对象数组的几分之一，读取也更快：

```ts
const data = shallowRef({
  region: ['华东', '华南' /* … */],
  city: ['上海', '广州' /* … */],
  amount: new Float64Array([128, 96 /* … */]),
})
```

所有列的长度应当相同。`cell-click` 的 `records()` 会按下标把各列的值拼成对象。

### 在 worker 中汇总

记录超过 10 万条时，表格自动在 worker 中汇总，汇总时页面照常响应：页面把需要的字段分片读取（每片不超过几毫秒），读好后整块交给 worker，不会占用或修改你传入的数组；之后调整布局只发送配置。汇总超过 120 毫秒时，表格保留上一次的结果，盖一层浅色并显示“正在汇总…”，新的结果出来后替换。

`:worker="true"` 不论多少条都用 worker，`:worker="false"` 总是在页面中汇总。不支持 worker 的环境（服务端渲染、测试）总是在页面中汇总。

表格自带的 worker 打包在组件里，以 `blob:` 地址启动。站点设置了内容安全策略（CSP）时，需要在 `worker-src` 中允许 `blob:`。如果不能放开，可以用 `:worker="false"` 在页面中汇总，或者像下面这样用 `createPivotWorker` 加载自己的 worker 文件。自带的 worker 无法启动时，表格会在控制台给出提示，并改为在页面中汇总。

自定义的汇总方式是函数，不能发送给 worker。用到它们时，自己写一个 worker 文件，在里面用 `servePivot` 注册，再用 `createPivotWorker` 传给表格：

```ts
// pivot.worker.ts
import { servePivot } from '@dou-ui/pivot/worker'
import { weightedPrice } from './aggregators'

servePivot({ aggregators: [weightedPrice] })
```

```vue
<script setup>
import { createPivotWorker } from '@dou-ui/pivot/worker'
import PivotWorker from './pivot.worker?worker'

const engine = createPivotWorker(() => new PivotWorker())
</script>

<template>
  <DouPivot :data="data" :engine="engine" :aggregators="[weightedPrice]" />
</template>
```

页面上的 `aggregators` 仍然要传，表头需要用它们的名字。

### 在服务端汇总

`engine` 可以是任何带 `compute` 方法的对象，比如把配置发给服务端。服务端用内核汇总，把结果打包成 JSON 返回，页面再还原：

```ts
// 服务端
import { computePivot, PivotSource } from '@dou-ui/pivot/engine'

const result = computePivot(new PivotSource(orders, { fields }), config)
return JSON.stringify(result.pack({ plain: true }))
```

```ts
// 页面
import { PivotResult } from '@dou-ui/pivot/engine'

const engine = {
  async compute(source, config, { signal }) {
    const response = await fetch('/api/pivot', {
      method: 'POST',
      body: JSON.stringify(config),
      signal,
    })
    return PivotResult.unpack(await response.json(), source, config)
  },
}
```

这时 `data` 只需要给出字段（例如 `{ region: [], amount: [] }` 配合 `fields`），用来显示字段名和格式；`cell-click` 的 `records()` 拿不到服务端的记录，按 `row` 和 `column` 向服务端查询即可。

## 键盘

表格可以聚焦，方向键移动选中的格子；在组名上按 → 展开、按 ← 折叠或回到上一级，Enter 或空格切换展开。Page Up / Page Down 翻页，Home / End 跳到行首、行尾，加上 Ctrl 或 ⌘ 跳到第一行、最后一行。

以上移动键加上 Shift 会扩大选中的范围。Ctrl / ⌘ + A 全选，Ctrl / ⌘ + C 复制，Esc 取消选中的范围。

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

`get` 返回汇总的结果；值有 `show` 时，`shown(row, column, valueIndex)` 返回换算后显示的数字，`range(valueIndex)` 返回最内层格子的最小值和最大值。

同一个 `PivotSource` 可以反复计算不同的布局，已经读过的字段不会再读。

## API

### Pivot Props

| 名称               | 说明                                              | 类型                       | 默认值         |
| ------------------ | ------------------------------------------------- | -------------------------- | -------------- |
| `data`             | 记录：对象数组，或按列给出的数组                  | `object[] \| PivotColumns` | —              |
| `fields`           | 字段的说明                                        | `PivotField[]`             | 从记录的键推断 |
| `config`           | 字段放在哪里，支持 `v-model:config`               | `PivotConfig`              | `{}`           |
| `collapsed`        | 折叠的组，支持 `v-model:collapsed`                | `PivotCollapsed`           | `{}`           |
| `max-height`       | 最大高度，数字按 px 计算；内容更少时随内容变矮    | `number \| string`         | `480`          |
| `size`             | 行高：28、32、40px                                | `'sm' \| 'md' \| 'lg'`     | `'md'`         |
| `row-header-width` | 行头的宽度（px），窄屏上会自动收窄                | `number`                   | `200`          |
| `column-width`     | 每个数值列的最小宽度（px），表格较宽时会适当加宽  | `number`                   | `120`          |
| `layout`           | 紧凑式或表格式布局                                | `'compact' \| 'tabular'`   | `'compact'`    |
| `resizable`        | 能否拖动调整列宽                                  | `boolean`                  | `true`         |
| `worker`           | 是否在 worker 中汇总；`'auto'` 超过 10 万条时使用 | `boolean \| 'auto'`        | `'auto'`       |
| `engine`           | 在别处汇总：自己的 worker 或服务端                | `PivotEngine`              | —              |
| `aggregators`      | 自定义的汇总方式                                  | `PivotAggregator[]`        | —              |
| `aria-label`       | 读屏读出的名称                                    | `string`                   | `'数据透视表'` |
| `messages`         | 替换语言包里的文字                                | `PivotMessagesOverride`    | —              |

### PivotFields Props

| 名称          | 说明                                            | 类型                       | 默认值         |
| ------------- | ----------------------------------------------- | -------------------------- | -------------- |
| `data`        | 记录，和表格传同一份                            | `object[] \| PivotColumns` | —              |
| `fields`      | 字段的说明，和表格传同一份                      | `PivotField[]`             | 从记录的键推断 |
| `config`      | 字段放在哪里，支持 `v-model:config`             | `PivotConfig`              | `{}`           |
| `aggregators` | 自定义的汇总方式，会出现在值的菜单里            | `PivotAggregator[]`        | —              |
| `drawer`      | 是否收成按钮、从底部打开；`'auto'` 在窄屏上收起 | `boolean \| 'auto'`        | `'auto'`       |
| `messages`    | 替换语言包里的文字                              | `PivotMessagesOverride`    | —              |

### Pivot Events

| 名称               | 说明                       | 参数             |
| ------------------ | -------------------------- | ---------------- |
| `update:config`    | 在表格里排序时             | `PivotConfig`    |
| `update:collapsed` | 展开或折叠组时             | `PivotCollapsed` |
| `cell-click`       | 点击数字，或选中后按 Enter | `PivotCellEvent` |

### PivotCellEvent

| 名称         | 说明                                                                              | 类型                                  |
| ------------ | --------------------------------------------------------------------------------- | ------------------------------------- |
| `row`        | 行组从外到内的组名，总计行为 `[]`                                                 | `unknown[]`                           |
| `column`     | 列组从外到内的组名，总计列为 `[]`                                                 | `unknown[]`                           |
| `labels`     | 同样的行组和列组按表格里写出的文字，如 `{ row: ['2026年1月'], column: ['外卖'] }` | `{ row: string[], column: string[] }` |
| `valueIndex` | 值在 `config.values` 里的序号                                                     | `number`                              |
| `value`      | 格子里显示的数值（有 `show` 时是换算后的数），空格子为 `NaN`                      | `number`                              |
| `records`    | 汇总进这一格的记录                                                                | `() => object[]`                      |
| `indices`    | 这些记录在 `data` 里的下标                                                        | `() => number[]`                      |

### PivotConfig

| 名称       | 说明                     | 类型                                                                            | 默认值      |
| ---------- | ------------------------ | ------------------------------------------------------------------------------- | ----------- |
| `rows`     | 行上的字段               | `(string \| { field, sort?, subtotal?, by? })[]`                                | `[]`        |
| `columns`  | 列上的字段               | `(string \| { field, sort?, subtotal?, by? })[]`                                | `[]`        |
| `values`   | 要汇总的值               | `(string \| { field?, aggregate?, formula?, label?, format?, show?, mark? })[]` | 计数        |
| `filters`  | 按字段保留或排除组       | `Record<string, { include?, exclude?, top?, between?, by? }>`                   | —           |
| `valuesOn` | 多个值放在哪个方向       | `'columns' \| 'rows'`                                                           | `'columns'` |
| `sort`     | 按某一列的数值给行组排序 | `{ valueIndex: number, column?: unknown[], order } \| null`                     | —           |
| `totals`   | 总计行和总计列           | `{ rows?: boolean, columns?: boolean }`                                         | 都显示      |

### Pivot Methods

| 名称                              | 说明                                                      | 类型                                |
| --------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| `result`                          | 当前的汇总结果                                            | `PivotResult`                       |
| `expandAll({ axis? })`            | 展开所有组                                                | `(options?) => void`                |
| `collapseAll({ axis?, depth? })`  | 折叠从第 `depth` 层开始的所有组                           | `(options?) => void`                |
| `toggle(axis, path, open?)`       | 展开或折叠一个组                                          | `(axis, path, open?) => void`       |
| `selectAll()`                     | 选中全部格子                                              | `() => void`                        |
| `copy({ all? })`                  | 复制选中的格子，`all` 复制整张表                          | `(options?) => Promise<void>`       |
| `toCSV({ text?, bom? })`          | 导出 CSV                                                  | `(options?) => string`              |
| `toSheet({ name? })`              | 导出给 `DouSheet` 的工作簿                                | `(options?) => PivotSheetWorkbook`  |
| `toChartRows(options?)`           | 导出给图表的行数据和系列，`options.valueIndex` 只取一个值 | `(options?) => { x, rows, series }` |
| `toGrid()`                        | 每个格子的 `text`、`kind`、`value`、`total` 和合并范围    | `() => PivotGrid`                   |
| `print({ title?, orientation? })` | 打印整张表                                                | `(options?) => void`                |

### Worker 与引擎

| 名称                                          | 说明                                                             |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `createPivotWorker(worker)`                   | 用一个 worker（或创建它的函数）做汇总，返回给 `engine` 用的对象  |
| `servePivot(options?)`                        | 在 worker 文件里调用，`options.aggregators` 注册自定义的汇总方式 |
| `result.pack(options?)`                       | 把结果打包成数据；`{ plain: true }` 得到能写成 JSON 的普通数组   |
| `PivotResult.unpack(packet, source, config?)` | 从打包的数据还原结果，`source` 提供字段的名字和格式              |

`PivotEngine` 只有一个必需的方法 `compute(source, config, { signal, aggregators })`，返回 `Promise<PivotResult>`；有新的配置时，旧的请求会收到 `signal` 的中止。可选的 `dispose()` 释放它占用的资源：表格自己创建的 worker 会在卸载时关闭，传入的 `engine` 不再使用时由你调用 `dispose()`。

### CSS 变量

| 变量                         | 说明                               |
| ---------------------------- | ---------------------------------- |
| `--dou-pivot-line`           | 格子之间的线                       |
| `--dou-pivot-line-strong`    | 表头、行头的分隔线                 |
| `--dou-pivot-head-bg`        | 表头和总计行的背景                 |
| `--dou-pivot-total-bg`       | 合计列和总计列的背景               |
| `--dou-pivot-ring`           | 键盘选中格子的边框颜色             |
| `--dou-pivot-selected`       | 选中范围的底色                     |
| `--dou-pivot-scale-strength` | 色阶最深时语气色的比例，默认 `28%` |
| `--dou-pivot-bar-strength`   | 数据条语气色的比例，默认 `12%`     |

### 读屏

表格是一个树形网格（`role="treegrid"`）：每行带有层级（`aria-level`），组所在的行带有展开状态（`aria-expanded`），排序中的表头带有 `aria-sort`。表格可以多选（`aria-multiselectable`），选中范围内的格子带有 `aria-selected`。用方向键移动时，读屏读出选中的格子。选中一片格子、复制、展开或折叠一组时，表格通过一个隐藏的 `role="status"` 区域播报结果，比如“已选中 3 行 2 列”“已复制 6 个格子”。
