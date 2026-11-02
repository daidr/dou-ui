---
wide: true
---

# 查看明细

点击一个数字可以查看汇总进这一格的记录。

## 基础用法

点击一个数字，或用方向键选中后按 Enter，会触发 `cellClick`。下面的例子在抽屉里用表格列出这一格的订单：

<DocDemo src="pivot/details" />

`cellClick` 的参数里有：

- `row`、`column`：行组和列组从外到内的组名，是原始值，比如按月分组时是 `'2026-01'`；总计为 `[]`；
- `labels`：同样的行组和列组按表格里写出的文字；
- `valueIndex` 和 `value`：值的序号和格子里显示的数字；
- `records()`：汇总进这一格的记录，`indices()` 返回它们在 `data` 里的下标。

`records()` 和 `indices()` 在调用时才去查找记录，点击本身不会多花时间。总计格子包含所有记录，数据量大时列表要用虚拟滚动，例子里的表格加了 `virtual`。

## 标出行和列

`highlight` 标出一个行组和一个列组，两者相交的格子最醒目。路径和 `cellClick` 给出的 `row`、`column` 相同，上面的例子在抽屉打开时标出了被点击的格子：

```vue-html
<DouPivot :highlight="{ row: cell.row, column: cell.column }" />
```

只传 `row` 或 `column` 时只标出一个方向。路径找不到对应的组时不标出。

## API

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
