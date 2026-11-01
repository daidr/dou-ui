# 导出 xlsx

`@dou-ui/sheet-xlsx` 是电子表格的一个扩展，把工作簿写成 `.xlsx` 文件，常见的表格软件都能直接打开。它不依赖其他库，压缩用的是浏览器自带的 `CompressionStream`。

## 安装

```sh
bun add @dou-ui/sheet-xlsx
```

## 基础用法

把 `xlsx()` 加到表格的 `extensions` 里，工具栏的导出菜单就会多出 XLSX：

```vue
<script setup lang="ts">
import { DouSheet, DouSheetToolbar } from '@dou-ui/sheet'
import { xlsx } from '@dou-ui/sheet-xlsx'

const extensions = [xlsx()]
</script>

<template>
  <DouSheet v-model="book" :extensions="extensions">
    <template #header>
      <DouSheetToolbar :tools="['export']" />
    </template>
  </DouSheet>
</template>
```

<DocDemo src="sheet/xlsx" column />

可以导出整个工作簿、当前工作表或选区：工具栏的导出菜单里，XLSX 会展开子菜单让你选，选中了一片区域时多出“选区”一项。用代码导出时和其他导出方式一样，默认导出整个工作簿：

```ts
// 导出并下载
await grid.value.saveFile('xlsx', { fileName: '门店营收.xlsx' })
// 只要 Blob
const blob = await grid.value.exportFile('xlsx', {
  scope: 'sheet',
  options: { formulas: 'values' },
})
```

不经过组件时，用 `exportWorkbook` 和 `xlsxExporter`，在 Worker 或服务端也能用：

```ts
import { exportWorkbook } from '@dou-ui/sheet'
import { xlsxExporter } from '@dou-ui/sheet-xlsx'

const blob = await exportWorkbook(book, xlsxExporter)
```

## 选项

选项可以在 `xlsx(options)` 里给出，作为每次导出的默认值；`exportFile` 的 `options` 会覆盖它们。

| 名称        | 说明                                                                                                               | 默认值                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `formulas`  | `'keep'` 写入公式和计算结果；`'values'` 只写结果，适合用了扩展函数、其他软件算不出来的公式。导出选区时总是只写结果 | `'keep'`                             |
| `colWidth`  | 表格默认的列宽（px），和 `DouSheet` 的 `col-width` 一致时，文件里没有单独设过宽度的列和表格里一样宽                | `96`                                 |
| `rowHeight` | 表格默认的行高（px），对应 `DouSheet` 的 `row-height`                                                              | `28`                                 |
| `label`     | 导出菜单里的名字（只在 `xlsx()` 里）                                                                               | 按表格的语言，如 `XLSX 文件 (.xlsx)` |

## 写进文件的内容

| 内容       | 说明                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 值         | 数字、文字、布尔值；日期和时间写成日期值，带上它的格式，没有格式时是 `yyyy-mm-dd`、`hh:mm`                         |
| 公式       | 公式和计算结果，打开时会重新计算；文字形式的 `=…`（存为 `'=…`）写成文字                                            |
| 格式与样式 | 数字格式；粗体、斜体、下划线、删除线、文字颜色、底色、对齐和换行。`tone`、`fill` 换成浅色主题下的颜色              |
| 布局       | 合并单元格、冻结的行列、列宽行高、隐藏的行列；分组写成分级显示，折叠的组隐藏                                       |
| 规则       | 条件格式（色阶、数据条也会写入）、数据验证、筛选；单元格类型是下拉选项的，写成下拉列表验证；被筛选掉的行写成隐藏行 |
| 其他       | 批注；单元格类型写入它的 `plain` 值，比如评分写成数字                                                              |

表格软件要求工作表名不超过 31 个字符、不含 `[]:*?/\`：超长的名字会截断，这些字符换成 `_`，因此重名的工作表名后面加上序号。公式在表格里依赖自己时（`#CYCLE!`），文件里的结果写成 `#VALUE!`；写错的公式按文字写入。

## 大文件

10 万行 × 20 列的工作表在桌面浏览器里大约 2 秒导出完，文件约 4 MB。导出过程中会定时让出主线程，页面不会卡住，传入的 `signal` 取消时会中途停下。
