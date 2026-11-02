---
wide: true
---

# 透视图

`toChartRows()` 把表格里的组转成 [`@dou-ui/chart`](../chart/) 的行数据和系列，表格和图表展示同一份汇总。

## 基础用法

<DocDemo src="pivot/chart" />

`toChartRows()` 返回 `{ x, rows, series }`：

- 每个没有展开的行组是一行，展开的组换成它的子组；
- 每个列组是一个系列；
- 小计和总计不在里面。

把 `rows` 交给图表的 `data`、`x` 交给 `x`，再为每个系列放一个柱子或折线：

```vue-html
<DouChart :data="chart.rows" :x="chart.x">
  <DouChartAxis for="y" :format="chart.series[0]?.format" />
  <DouChartBar v-for="s in chart.series" :key="s.key" :y="s.key" :name="s.name" stack />
</DouChart>
```

在 `computed` 里调用 `toChartRows()`，表格展开、折叠或换了字段时图会跟着更新。

## 数字格式

每个系列带有 `format`，按表格的写法写出数字。把它交给坐标轴的 `format`，刻度就和表格一致，比如 `¥10,000`。

## 多个值

有多个值时，每个列组和值的组合是一个系列。`toChartRows({ valueIndex })` 只取其中一个值。

## 空数据

空格子是 `null`，图表里会断开。没有数据时返回 `{ x: 'label', rows: [], series: [] }`。

## API

### PivotChartRows

| 名称     | 说明                             | 类型                                         |
| -------- | -------------------------------- | -------------------------------------------- |
| `x`      | 每一行里组名的键                 | `'label'`                                    |
| `rows`   | 每个行组一行                     | `Record<string, string \| number \| null>[]` |
| `series` | 每个列组（和值）一个系列，见下表 | `object[]`                                   |

### series 的每一项

| 名称         | 说明                               | 类型                    |
| ------------ | ---------------------------------- | ----------------------- |
| `key`        | 这个系列的数字在每一行里的键       | `string`                |
| `name`       | 列组的名字，有多个值时带上值的名字 | `string`                |
| `valueIndex` | 值在 `values` 里的序号             | `number`                |
| `format`     | 按表格的写法写出数字               | `(n: number) => string` |
