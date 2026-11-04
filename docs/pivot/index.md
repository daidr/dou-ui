---
wide: true
---

# 数据透视

`@dou-ui/pivot` 把一组明细记录按字段分组汇总成交叉表。选好哪些字段放在行上、哪些放在列上、汇总哪些数值，表格会算出每个组合的结果，以及各级小计和总计。

透视表只读取传入的记录，不会修改它们。10 万条记录的分组汇总在几十毫秒内完成，只调整排序、展开或折叠时不会重新汇总。完整页面的写法见区块中的[销售分析](../blocks/sales-analysis)和[工单统计](../blocks/ticket-stats)。

## 安装

数据透视是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/pivot
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/pivot/style.css'
import { DouPivot, DouPivotFields } from '@dou-ui/pivot'

app.use(DouPivot)
app.use(DouPivotFields)
```

## 基础用法

`data` 是一组记录，`fields` 说明每个字段的名称和显示方式，`config` 决定字段放在哪里：

- `rows`：放在行上的字段，从外到内逐级分组；
- `columns`：放在列上的字段；
- `values`：要汇总的数值。

<DocDemo src="pivot/basic" />

行上的多个字段显示成一棵树，组所在的行显示这一组的小计。列上的多个字段显示成多级表头，展开的组后面有一列“合计”。最下方的总计行在滚动时始终可见，最右侧是总计列。

`config` 支持 `v-model:config`，在表格里排序时会更新它。它是普通的数据，可以直接保存下来，下次打开时恢复同样的视图。

## 字段

`fields` 是一个数组，每一项描述一个字段：

```ts
import type { PivotConfig, PivotField } from '@dou-ui/pivot'
import { ref } from 'vue'

interface Order {
  region: string
  month: number
  amount: number
  cost: number
}

const fields: PivotField<Order>[] = [
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

const config = ref<PivotConfig>({ rows: ['region'], columns: ['month'], values: ['amount'] })
```

- 给 `PivotField` 传入记录的类型，`value` 收到的 `row` 就带有类型。`config` 用 `PivotConfig` 标注，后面各页的片段只写出其中的字段。
- `name` 是记录上的键，`config` 里用它指代字段；`label` 是表头上显示的名字。
- `type` 不写时根据前 100 条记录推断。
- `format` 决定组名或数值怎么显示：数字字段传 `Intl.NumberFormat` 的选项，日期字段传 `Intl.DateTimeFormat` 的选项，或者传一个函数。
- `order` 指定组的顺序，没有列出的组排在后面。
- `value` 从记录算出字段的值，用来定义记录上没有的字段。

不传 `fields` 时，字段从记录的键推断，表头显示键名。

空值（`null`、`undefined`、空字符串、`NaN`）归为一组，显示为“（空）”，总是排在最后。

## 尺寸

`size` 设置行高，`sm`、`md`、`lg` 分别是 28、32、40px。`maxHeight` 是表格的最大高度，内容更少时表格随内容变矮；宽度总是占满容器。

`rowHeaderWidth` 是行头的宽度，窄屏上会自动收窄；`columnWidth` 是每个数值列的最小宽度，表格较宽时会适当加宽。

## 语言

表格和字段面板里的文字（“总计”“（空）”、汇总方式的名称、菜单和对话框等）跟随 [ConfigProvider](/components/config-provider) 的语言，内置简体中文、繁体中文和英文。

`messages` 可以改写其中几条：

```vue-html
<DouPivot :data="orders" :config="config" :messages="{ total: '全部', empty: '未填写' }" />
```

- `messages.aggregates` 里可以给[自定义汇总方式](./values#自定义汇总方式)起名字，键是它的 `name`。
- `pivotLocales` 是内置的三份文案，按语言名称（如 `'zh-CN'`）索引。要支持其他语言时，往里面加一份完整的 `PivotMessages`。
- `usePivotMessages(override?)` 返回当前语言的文案，自己的界面里需要相同的文字时使用。

## API

### Pivot Props

| 名称             | 说明                                                                                                    | 类型                                      | 默认值         |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------- |
| `data`           | 记录：对象数组，或[按列给出](./performance#按列给出数据)的数组                                          | `object[] \| PivotColumns`                | —              |
| `fields`         | 字段的说明                                                                                              | `PivotField[]`                            | 从记录的键推断 |
| `config`         | 字段放在哪里，支持 `v-model:config`                                                                     | `PivotConfig`                             | `{}`           |
| `collapsed`      | 折叠的组，支持 `v-model:collapsed`，见[展开与折叠](./layout#展开与折叠)                                 | `PivotCollapsed`                          | `{}`           |
| `maxHeight`      | 最大高度，数字按 px 计算；内容更少时随内容变矮                                                          | `number \| string`                        | `480`          |
| `size`           | 行高：28、32、40px                                                                                      | `'sm' \| 'md' \| 'lg'`                    | `'md'`         |
| `bordered`       | 外框和圆角；关闭后外框和圆角，用于放进已有边框的容器，见[去掉外框](/guide/theming#去掉外框与调整内边距) | `boolean`                                 | `true`         |
| `rowHeaderWidth` | 行头的宽度（px），窄屏上会自动收窄                                                                      | `number`                                  | `200`          |
| `columnWidth`    | 每个数值列的最小宽度（px），表格较宽时会适当加宽                                                        | `number`                                  | `120`          |
| `layout`         | 紧凑式或表格式[布局](./layout)                                                                          | `'compact' \| 'tabular'`                  | `'compact'`    |
| `resizable`      | 能否拖动调整列宽                                                                                        | `boolean`                                 | `true`         |
| `worker`         | 是否[在 worker 中汇总](./performance#在-worker-中汇总)；`'auto'` 超过 10 万条时使用                     | `boolean \| 'auto'`                       | `'auto'`       |
| `engine`         | 在别处汇总：自己的 worker 或服务端                                                                      | `PivotEngine`                             | —              |
| `aggregators`    | [自定义的汇总方式](./values#自定义汇总方式)                                                             | `PivotAggregator[]`                       | —              |
| `highlight`      | [标出](./details#标出行和列)一个行组和一个列组，路径同 `cellClick` 给出的 `row`、`column`               | `{ row?: PivotPath; column?: PivotPath }` | —              |
| `ariaLabel`      | 读屏读出的名称                                                                                          | `string`                                  | `'数据透视表'` |
| `messages`       | 替换语言包里的文字                                                                                      | `PivotMessagesOverride`                   | —              |

### Pivot Events

| 名称               | 说明                                                | 参数             |
| ------------------ | --------------------------------------------------- | ---------------- |
| `update:config`    | 在表格里排序时                                      | `PivotConfig`    |
| `update:collapsed` | 展开或折叠组时                                      | `PivotCollapsed` |
| `cellClick`        | 点击数字，或选中后按 Enter，见[查看明细](./details) | `PivotCellEvent` |

### Pivot Exposes

| 名称                              | 说明                                               | 类型                               |
| --------------------------------- | -------------------------------------------------- | ---------------------------------- |
| `result`                          | 当前的汇总结果，见[汇总内核](./engine#pivotresult) | `PivotResult`                      |
| `expandAll({ axis? })`            | 展开所有组                                         | `(options?) => void`               |
| `collapseAll({ axis?, depth? })`  | 折叠从第 `depth` 级开始的所有组                    | `(options?) => void`               |
| `toggle(axis, path, open?)`       | 展开或折叠一个组                                   | `(axis, path, open?) => void`      |
| `selectAll()`                     | 选中全部格子                                       | `() => void`                       |
| `copy({ all? })`                  | 复制选中的格子，`all` 复制整张表                   | `(options?) => Promise<void>`      |
| `toCSV(options?)`                 | 导出 CSV，见[复制与导出](./export#导出)            | `(options?) => string`             |
| `toSheet({ name? })`              | 导出给 `DouSheet` 的工作簿                         | `(options?) => PivotSheetWorkbook` |
| `toChartRows({ valueIndex? })`    | 导出给图表的行数据和系列，见[透视图](./chart)      | `(options?) => PivotChartRows`     |
| `toGrid()`                        | 每个格子的文字、数值和类型                         | `() => PivotGrid`                  |
| `print({ title?, orientation? })` | 打印整张表                                         | `(options?) => void`               |

### PivotField

| 名称     | 说明                                 | 类型                                                                          | 默认值          |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------- | --------------- |
| `name`   | 记录上的键，`config` 里用它指代字段  | `string`                                                                      | —               |
| `label`  | 表头和字段面板上显示的名字           | `string`                                                                      | `name`          |
| `type`   | 字段的类型，决定怎么分组、排序和显示 | `'string' \| 'number' \| 'date' \| 'boolean'`                                 | 按前 100 条推断 |
| `format` | 组名或数值的写法                     | `Intl.NumberFormatOptions \| Intl.DateTimeFormatOptions \| (value) => string` | —               |
| `order`  | 排在前面的组，按列出的顺序           | `unknown[]`                                                                   | —               |
| `value`  | 从记录算出字段的值                   | `(row, index) => unknown`                                                     | 读 `row[name]`  |

### PivotConfig

| 名称       | 说明                                                  | 类型                                    | 默认值      |
| ---------- | ----------------------------------------------------- | --------------------------------------- | ----------- |
| `rows`     | 行上的字段，对象写法见[分组](./grouping#分组)         | `(string \| PivotDimension)[]`          | `[]`        |
| `columns`  | 列上的字段                                            | `(string \| PivotDimension)[]`          | `[]`        |
| `values`   | 要汇总的值，对象写法见[汇总方式](./values#pivotvalue) | `(string \| PivotValue)[]`              | 计数        |
| `filters`  | 按字段[筛选](./grouping#筛选)                         | `Record<string, PivotFilter>`           | —           |
| `valuesOn` | 多个值放在哪个方向                                    | `'columns' \| 'rows'`                   | `'columns'` |
| `sort`     | 按某一列的数值给行组[排序](./grouping#排序)           | `PivotValueSort \| null`                | —           |
| `totals`   | 总计行和总计列，见[总计](./layout#总计)               | `{ rows?: boolean, columns?: boolean }` | 都显示      |

### CSS 变量

| 变量                            | 说明                                     |
| ------------------------------- | ---------------------------------------- |
| `--dou-pivot-line`              | 格子之间的线                             |
| `--dou-pivot-line-strong`       | 表头、行头的分隔线                       |
| `--dou-pivot-head-bg`           | 表头和总计行的背景                       |
| `--dou-pivot-total-bg`          | 合计列和总计列的背景                     |
| `--dou-pivot-ring`              | 键盘选中格子的边框颜色                   |
| `--dou-pivot-selected`          | 选中范围的底色                           |
| `--dou-pivot-scale-strength`    | 色阶最深时语气色的比例，默认 `28%`       |
| `--dou-pivot-bar-strength`      | 数据条语气色的比例，默认 `12%`           |
| `--dou-pivot-bar-strength-dark` | 深色主题下数据条语气色的比例，默认 `24%` |
