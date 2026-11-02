---
wide: true
---

# 汇总方式

`config.values` 决定汇总哪些数值、怎么汇总。

## 基础用法

`values` 的每一项可以是字段名，也可以是一个对象。下面的例子汇总了销售额、杯数和客单价：

<DocDemo src="pivot/values" />

```ts
values: [
  'amount', // 数字字段默认求和，其他字段默认计数
  { field: 'amount', aggregate: 'avg', label: '客单价' },
  { aggregate: 'count', label: '订单数' }, // 不写 field：数记录的条数
]
```

内置的汇总方式：

- `sum`：求和；
- `count`：计数，非空值的个数；
- `avg`：平均值；
- `min`、`max`：最小值、最大值；
- `distinct`：去重计数，不同值的个数；
- `median`：中位数。

`values` 为空时显示一列“计数”，统计每组有多少条记录。

求和的表头用字段名，其他方式写成“字段 · 方式”，比如“销售额 · 平均值”。`label` 可以改成别的文字。`format` 可以单独指定这一项的显示格式，不写时用字段的 `format`。

## 多个值

有多个值时，默认放在列上，每个列组下面各有一列；`valuesOn: 'rows'` 把它们放到行上，每个行组占几行，上面例子里的切换按钮演示了两种放法。

只有一个值时，值的名称只在左上角显示一次，不在每一列下面重复。

## 自定义汇总方式

`defineAggregator` 定义新的汇总方式，通过 `aggregators` 传给表格，`config` 里用它的 `name` 引用：

<DocDemo src="pivot/aggregator" />

- `init` 创建一个组的初始状态，`add` 把一条记录的值加进状态，`result` 从状态算出显示的数字。
- `merge` 把两个组的状态合并成一个。小计和总计由内层各组的状态合并而来，不会再逐条读取记录，所以 `merge` 必须得到和逐条 `add` 一样的结果。
- `input` 默认是 `'number'`，`add` 收到的是数字，没有数字的记录会跳过；设为 `'value'` 时收到字段的原始值，空值跳过。

字段面板要用到自定义汇总方式时，同样把 `aggregators` 传给 `DouPivotFields`。在 worker 中汇总时，自定义汇总方式要在 worker 文件里注册，见[在 worker 中汇总](./performance#在-worker-中汇总)。

## API

### PivotValue

| 名称        | 说明                                                       | 类型                                  | 默认值                           |
| ----------- | ---------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| `field`     | 要汇总的字段；`count` 不写时数记录的条数                   | `string`                              | —                                |
| `aggregate` | 内置汇总方式的名称，或 `defineAggregator` 定义的 `name`    | `string`                              | 数字字段 `'sum'`，其他 `'count'` |
| `formula`   | [计算值](./formula)的公式，这时不写 `field` 和 `aggregate` | `string`                              | —                                |
| `label`     | 表头                                                       | `string`                              | 按字段和方式生成                 |
| `format`    | 数值的写法                                                 | `PivotFormat`                         | 字段的 `format`                  |
| `show`      | [显示方式](./show)                                         | `PivotShowAs \| { as, axis? }`        | —                                |
| `mark`      | [条件格式](./mark)                                         | `'bar' \| 'scale' \| { type, tone? }` | —                                |

### defineAggregator

| 名称      | 说明                                             | 类型                        | 默认值     |
| --------- | ------------------------------------------------ | --------------------------- | ---------- |
| `name`    | 在 `config` 里引用的名字                         | `string`                    | —          |
| `label`   | 表头上的方式名称，如“销售额 · 极差”里的“极差”    | `string`                    | `name`     |
| `input`   | `add` 收到数字还是原始值                         | `'number' \| 'value'`       | `'number'` |
| `init`    | 创建一个组的初始状态                             | `() => State`               | —          |
| `add`     | 把一条记录的值加进状态，返回新的状态             | `(state, value) => State`   | —          |
| `merge`   | 把 `from` 合并进 `into`，返回合并后的状态        | `(into, from) => State`     | —          |
| `result`  | 从状态算出显示的数字，空格子返回 `null` 或 `NaN` | `(state) => number \| null` | —          |
| `integer` | 结果是否总是整数（如计数），整数不显示小数       | `boolean`                   | `false`    |
