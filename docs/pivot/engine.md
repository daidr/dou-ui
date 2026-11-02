# 不用组件

汇总的内核在 `@dou-ui/pivot/engine` 里，可以单独使用，比如在服务端或 worker 里。

## 基础用法

```ts
import { computePivot, PivotSource } from '@dou-ui/pivot/engine'

const source = new PivotSource(orders, { fields })
const result = computePivot(source, {
  rows: ['region'],
  columns: ['quarter'],
  values: ['amount', 'cups'],
})

const east = result.rows.find(['华东'])
result.get(east, result.columns.total) // 华东的销售额（列上的总计）
result.get(east, result.columns.find(['Q1']), 1) // 华东 Q1 的杯数
```

- `PivotSource` 包装一份记录，字段按需读取并缓存。同一个 `PivotSource` 可以反复计算不同的布局，已经读过的字段不会再读。
- `computePivot` 按 `config` 汇总，返回 `PivotResult`。
- 组件的 ref 上的 `result` 也是 `PivotResult`。

## 读取结果

`result.rows` 和 `result.columns` 是两个方向上的组，每个组用一个编号表示，`total` 是总计：

- `find(path)` 按从外到内的组名找到组的编号，找不到时返回 `-1`；
- `path(node)` 和 `label(node)` 返回组的组名；
- `isGroup(node)` 表示这个组里面还有下一级的组。

`result.get(row, column, valueIndex?)` 返回汇总的结果。值有 `show` 时，`shown(row, column, valueIndex?)` 返回换算后显示的数字。`range(valueIndex?)` 返回最内层格子的最小值和最大值。

## 自定义汇总方式

`computePivot` 的第三个参数按名字传入[自定义汇总方式](./values#自定义汇总方式)：

```ts
computePivot(source, config, { aggregators: { spread } })
```

## API

### PivotSource

| 参数      | 说明                                           | 类型                       |
| --------- | ---------------------------------------------- | -------------------------- |
| `data`    | 记录：对象数组，或按列给出的数组               | `object[] \| PivotColumns` |
| `options` | `fields` 是字段的说明，`locale` 用于给组名排序 | `{ fields?, locale? }`     |

### computePivot

| 参数      | 说明                       | 类型                                                |
| --------- | -------------------------- | --------------------------------------------------- |
| `source`  | 记录                       | `PivotSource`                                       |
| `config`  | 字段放在哪里               | `PivotConfig`                                       |
| `options` | 按名字传入的自定义汇总方式 | `{ aggregators?: Record<string, PivotAggregator> }` |

### PivotResult

| 名称                              | 说明                                                     | 类型                           |
| --------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `rows` / `columns`                | 两个方向上的组                                           | `PivotTree`                    |
| `values`                          | 每个值补全后的说明                                       | `PivotResolvedValue[]`         |
| `matched`                         | 通过筛选的记录条数                                       | `number`                       |
| `get(row, column, valueIndex?)`   | 汇总的结果，空格子为 `NaN`                               | `number`                       |
| `shown(row, column, valueIndex?)` | 显示的数字，有 `show` 时是换算后的数                     | `number`                       |
| `range(valueIndex?)`              | 最内层格子的最小值和最大值                               | `{ min: number, max: number }` |
| `indices(row, column)`            | 汇总进这一格的记录在 `data` 里的下标                     | `number[]`                     |
| `pack({ plain? })`                | 打包成数据，见[在服务端汇总](./performance#在服务端汇总) | `PivotPacket`                  |

### PivotTree

| 名称            | 说明                                | 类型        |
| --------------- | ----------------------------------- | ----------- |
| `total`         | 总计的编号                          | `number`    |
| `find(path)`    | 按组名找到组的编号，找不到时为 `-1` | `number`    |
| `path(node)`    | 组从外到内的组名                    | `unknown[]` |
| `label(node)`   | 组自己的组名                        | `unknown`   |
| `isGroup(node)` | 里面是否还有下一级的组              | `boolean`   |
