---
wide: true
---

# 复制与导出

表格里的格子可以复制到剪贴板，整张表可以导出成 CSV、电子表格的工作簿或其他文件，也可以打印。

## 选择与复制

用鼠标在格子上拖动，或者按住 Shift 点击、按 Shift + 方向键，可以选中一片格子。Ctrl / ⌘ + A 选中全部，Esc 取消。

按 Ctrl / ⌘ + C 复制，剪贴板里同时有两种内容：

- 用制表符分隔的文字，数字按表格里显示的样子写，粘到文本编辑器里也能对齐；
- 一张 HTML 表格，粘到电子表格软件里，每个数字占一格。

粘到 [`DouSheet`](../sheet/) 里时，数字保留原来的值和格式，比如占比仍然是 `0.213`，显示为 `21.3%`，总计行是粗体。

选中的范围包括行头时，每个行字段各占一列。全选后复制会带上列的表头。手机上拖动用来滚动表格，不会选中格子。

通过 ref 调用 `copy()` 复制选中的格子，`copy({ all: true })` 复制整张表。

## 导出

表格通过 ref 提供几种导出方式，导出的都是当前看到的样子：折叠的组只有一行，显示方式、排序和筛选都和表格一致。导出时每个行字段占一列，和表格式布局一样。

<DocDemo src="pivot/export" />

- `toCSV(options?)`：CSV 文字。默认写数值（`1280`、`0.213`），`{ text: true }` 写显示的文字（`¥1,280`、`21.3%`）。
- `toSheet({ name? })`：给 `DouSheet` 的工作簿，数字带格式，表头合并并冻结，列宽和屏幕上一样。
- `toChartRows(options?)`：给 `@dou-ui/chart` 的行数据和系列，见[透视图](./chart)。
- `toGrid()`：每个格子的文字、数值和类型，用来自己生成别的格式。

数值去掉了汇总时的浮点误差，按 15 位有效数字取整，`1592.0200000000002` 写成 `1592.02`。

这些方法只返回内容。下载成文件可以用 `dou-ui` 的 [`downloadBlob`](../guide/composables#downloadblob)：

```ts
import { downloadBlob } from 'dou-ui'

downloadBlob(new Blob([pivot.value.toCSV()], { type: 'text/csv' }), '销售.csv')
```

### CSV 的选项

- CSV 默认以字节顺序标记开头，这样电子表格软件能按 UTF-8 打开，`{ bom: false }` 可以去掉。
- 组名以 `=`、`+`、`-`、`@`、制表符或回车开头时，前面会加上 `'`，防止在电子表格里被当成公式运行。确定文件不会被表格软件打开时，可以用 `{ escapeFormulas: false }` 原样写出。

## 转成电子表格

`toSheet()` 返回的对象可以直接作为 `DouSheet` 的 `v-model`，之后可以在表格里继续编辑、加公式。两个包互不依赖，各自单独安装。

<DocDemo src="pivot/sheet" />

## 导出成 Excel 等文件

电子表格的导出器也能导出透视表：把 `toSheet()` 交给 `@dou-ui/sheet/core` 的 `exportWorkbook`，用哪种导出器就得到哪种文件。比如用 `@dou-ui/sheet-xlsx` 导出 Excel 文件，表头合并、冻结、数字格式和列宽都会保留：

```ts
import { exportWorkbook } from '@dou-ui/sheet/core'
import { xlsxExporter } from '@dou-ui/sheet-xlsx'
import { downloadBlob } from 'dou-ui'

const blob = await exportWorkbook(pivot.value.toSheet({ name: '销售额' }), xlsxExporter)
downloadBlob(blob, '销售额.xlsx')
```

需要另外安装 `@dou-ui/sheet` 和 `@dou-ui/sheet-xlsx`。自己写的导出器也一样能用，写法见电子表格的[导出器与导入器](../sheet/exporters)。在仪表盘里，透视表格子可以直接从标题栏导出，见仪表盘的[导出格子的数据](../dashboard/widgets#导出格子的数据)。

## 打印

表格只渲染看得到的部分，直接打印页面只能打出一屏。`print()` 把整张表写成普通的表格再打印：

- 纸张是 A4，表格比竖向的纸宽时自动横向，列的表头在每一页重复；
- `title` 是表格上方的标题，默认用 `ariaLabel`；
- `orientation` 可以指定 `'portrait'` 或 `'landscape'`。

## API

### PivotCSVOptions

| 名称             | 说明                         | 类型      | 默认值  |
| ---------------- | ---------------------------- | --------- | ------- |
| `text`           | 写显示的文字，而不是数值     | `boolean` | `false` |
| `bom`            | 以字节顺序标记开头           | `boolean` | `true`  |
| `escapeFormulas` | 在会被当成公式的组名前加 `'` | `boolean` | `true`  |

### PivotPrintOptions

| 名称          | 说明           | 类型                        | 默认值             |
| ------------- | -------------- | --------------------------- | ------------------ |
| `title`       | 表格上方的标题 | `string`                    | `ariaLabel`        |
| `orientation` | 纸张方向       | `'portrait' \| 'landscape'` | 比竖向的纸宽时横向 |

### PivotGrid

`toGrid()` 的返回值：

| 名称       | 说明                                                                    | 类型                          |
| ---------- | ----------------------------------------------------------------------- | ----------------------------- |
| `cells`    | 逐行的格子，被合并的格子是 `null`                                       | `(PivotGridCell \| null)[][]` |
| `headRows` | 顶部有几行是列的表头                                                    | `number`                      |
| `headCols` | 左侧有几列是行头                                                        | `number`                      |
| `formats`  | 每个值在电子表格里的数字格式，如 `#,##0.00`、`0.0%`，按 `values` 的序号 | `(string \| undefined)[]`     |
| `widths`   | 每一列在屏幕上的宽度（px）                                              | `number[]`                    |

### PivotGridCell

| 名称                  | 说明                                                      | 类型                           |
| --------------------- | --------------------------------------------------------- | ------------------------------ |
| `text`                | 格子里显示的文字                                          | `string`                       |
| `kind`                | `head` 是列的表头或左上角，`label` 是行组，`value` 是数字 | `'head' \| 'label' \| 'value'` |
| `value`               | 数字格子显示的数值，空格子为 `NaN`                        | `number`                       |
| `valueIndex`          | 数字格子的值在 `values` 里的序号                          | `number`                       |
| `total`               | 是否是小计或总计                                          | `boolean`                      |
| `colSpan` / `rowSpan` | 跨几列、几行                                              | `number`                       |
