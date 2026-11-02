---
wide: true
---

# 显示方式

`show` 把值换一种方式显示：占比、与前一组的差值、累计或排名。汇总的结果不变，只是显示的数字不同。

## 基础用法

<DocDemo src="pivot/show" />

`show` 可以取：

- `percentOfTotal`：占总计的百分比；
- `percentOfRow`：占这一行合计的百分比；
- `percentOfColumn`：占这一列合计的百分比；
- `percentOfParent`：占上一级组的百分比；
- `difference`：与前一组的差值，第一组为空；
- `percentDifference`：与前一组相差的百分比；
- `runningTotal`：从第一组加到这一组的累计；
- `rank`：在同一级的组里的排名，最大的为 1，总计不排名。

表头会在值的名称后面加上显示方式，比如“销售额 · 占行合计”。百分比默认保留一位小数，差值带正负号，`format` 可以另外指定。

## 比较的方向

“前一组”“同一级”看的是一个方向（`axis`）上的组：

- 差值和累计默认沿列，即和左边一列的组比较、从左往右累加，比如按季度和上一季度比较；
- 占上一级和排名默认沿行，即和上一级的行组相比、在同一级的行组里排名。

这个方向上没有字段时换到另一个方向。要指定方向，写成对象：

```ts
{ field: 'amount', show: { as: 'difference', axis: 'rows' } } // 和上一行的组比较
```

组的先后按组名的顺序，不受按数值排序的影响。

## 点击和导出

`cellClick` 的 `value`、导出的 CSV 和 `toGrid()` 里都是显示的数字，比如占比是 `0.213`。要拿到汇总的原值，用 `result.get(row, column, valueIndex)`，见[不用组件](./engine)。

## API

### PivotShow

| 名称   | 说明                         | 类型                                                                                                                                              | 默认值                                    |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `as`   | 显示方式                     | `'percentOfTotal' \| 'percentOfRow' \| 'percentOfColumn' \| 'percentOfParent' \| 'difference' \| 'percentDifference' \| 'runningTotal' \| 'rank'` | —                                         |
| `axis` | 前一组、同一级看哪个方向的组 | `'rows' \| 'columns'`                                                                                                                             | 差值和累计为 `'columns'`，其他为 `'rows'` |
