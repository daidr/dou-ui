---
wide: true
---

# 布局与折叠

这一页介绍行头的两种布局、调整列宽、展开折叠组，以及去掉总计。

## 布局

默认的紧凑式布局把行上的字段放在同一列里，缩进成一棵树，组所在的行就是它的小计。`layout="tabular"` 改成表格式：每个行字段单独一列，组名只在这一组的第一行显示，展开的组在子项后面另起一行“小计”。

<DocDemo src="pivot/layout" />

## 列宽

拖动列标题的右边缘可以调整列宽，双击右边缘按内容调整。左上角的右边缘调整行头的宽度，双击恢复。

不需要时设置 `:resizable="false"`。

## 展开与折叠

点击组名或前面的箭头可以展开、折叠这一组，按住 Alt 点击会同时切换同一层的所有组。列上的组在表头里同样可以展开折叠。折叠的组只占一行或一列，显示这一组的合计。

<DocDemo src="pivot/collapse" />

`v-model:collapsed` 记录折叠了哪些组，每个组用它从外到内的组名表示：

```ts
const collapsed = ref({
  rows: [['华东'], ['华南', '广州']],
  columns: [['2026-Q1']],
})
```

记录的是“折叠了哪些”而不是“展开了哪些”，所以数据变化后新出现的组默认是展开的。

通过 ref 还可以一次展开或折叠多个组：

```ts
pivot.value.collapseAll({ axis: 'rows', depth: 2 }) // 行上只展开到第 2 层
pivot.value.expandAll() // 两个方向都全部展开
pivot.value.toggle('rows', ['华东'], false) // 折叠华东
```

## 总计

`totals: { rows: false }` 去掉底部的总计行，`totals: { columns: false }` 去掉右侧的总计列。某个字段不需要小计时，见[小计](./grouping#小计)。

## API

### PivotCollapsed

| 名称      | 说明                         | 类型          | 默认值 |
| --------- | ---------------------------- | ------------- | ------ |
| `rows`    | 折叠的行组，每项是组名的路径 | `unknown[][]` | `[]`   |
| `columns` | 折叠的列组                   | `unknown[][]` | `[]`   |

### Exposes

| 名称                             | 说明                                                                | 类型                          |
| -------------------------------- | ------------------------------------------------------------------- | ----------------------------- |
| `expandAll({ axis? })`           | 展开所有组，`axis` 是 `'rows'` 或 `'columns'`，不写时两个方向都展开 | `(options?) => void`          |
| `collapseAll({ axis?, depth? })` | 折叠从第 `depth` 层开始的所有组，`depth` 默认 1，即只显示最外层     | `(options?) => void`          |
| `toggle(axis, path, open?)`      | 展开或折叠一个组，不传 `open` 时切换                                | `(axis, path, open?) => void` |
