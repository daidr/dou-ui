# 导出 xlsx

`@dou-ui/sheet-xlsx` 是电子表格的一个扩展，把工作簿写成 `.xlsx` 文件，常见的表格软件都能直接打开。它不依赖其他库，压缩用的是运行环境自带的 `CompressionStream`：2023 年以后的主流浏览器、Node 18 以上、Bun 和 Deno 都有，没有时导出会报错并说明原因。

## 安装

```sh
bun add @dou-ui/sheet-xlsx
```

## 基础用法

把 `xlsx()` 加到表格的 `extensions` 里，工具栏的导出菜单就会多出 XLSX：

```vue
<script setup lang="ts">
import { DouSheet, DouSheetToolbar, type SheetWorkbook } from '@dou-ui/sheet'
import { xlsx } from '@dou-ui/sheet-xlsx'
import { ref } from 'vue'

const book = ref<SheetWorkbook>({ sheets: [{ name: '门店', cells: [['上海静安', 186400]] }] })
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

可以导出整个工作簿、当前工作表或选区。工具栏的导出菜单里，XLSX 有子菜单，可以选择整个工作簿或当前工作表，选中了一片区域时还可以选择选区。用代码导出时和其他导出方式一样，默认导出整个工作簿：

```ts
// 导出并下载
await grid.value.saveFile('xlsx', { fileName: '门店营收.xlsx' })
// 只要 Blob
const blob = await grid.value.exportFile('xlsx', { scope: 'sheet', options: { formulas: false } })
```

不经过组件时，把 `xlsxExporter` 交给 `exportWorkbook`，在脚本、Worker 或服务端都能用。表格的 `col-width`、`row-height` 不是默认的 96、28 时，在这里一并传入，文件里的列宽行高才和表格一致：

```ts
import { exportWorkbook } from '@dou-ui/sheet'
import { xlsxExporter } from '@dou-ui/sheet-xlsx'

const blob = await exportWorkbook(book, xlsxExporter, { colWidth: 120 })
```

`writeXlsx(source, options?)` 是 `xlsxExporter` 写文件的那一步，返回文件的字节。自己写导出器、想在别的格式之外再附带一份 `.xlsx` 时可以直接调用，`source` 就是导出器拿到的那个。

## 选项

选项可以在 `xlsx(options)` 里给出，作为每次导出的默认值；`exportFile` 的 `options` 会覆盖它们。

| 名称       | 说明                                                                                                     | 默认值                             |
| ---------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `formulas` | 写入公式和计算结果；`false` 时只写结果，适合用了扩展函数、其他软件算不出来的公式。导出选区时总是只写结果 | `true`                             |
| `label`    | 导出菜单里的名字（只在 `xlsx()` 里）                                                                     | 由表格文案 `file.csv` 得出，见下文 |

导出菜单里的名字默认由表格的文案 `file.csv` 得出，把其中的“CSV”换成“XLSX”、`.csv` 换成 `.xlsx`，如 `CSV 文件 (.csv)` 得出 `XLSX 文件 (.xlsx)`。改过 `file.csv`、里面不再有“CSV”时，名字是 `XLSX (.xlsx)`，这时用 `label` 指定。

## 写进文件的内容

| 内容       | 说明                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 值         | 数字、文字、布尔值；日期和时间写成日期值，带上它的格式，没有格式时是 `yyyy-mm-dd`、`hh:mm`。公式算出的日期也一样   |
| 公式       | 公式和计算结果，打开时会重新计算；文字形式的 `=…`（存为 `'=…`）写成文字，在其他软件里编辑后仍是文字                |
| 格式与样式 | 数字格式；粗体、斜体、下划线、删除线、文字颜色、底色、对齐和换行。`tone`、`fill` 换成浅色主题下的颜色              |
| 布局       | 合并单元格、冻结的行列、列宽行高、隐藏的行列；分组写成分级显示，折叠的组隐藏                                       |
| 规则       | 条件格式（色阶、数据条也会写入）、数据验证、筛选；单元格类型是下拉选项的，写成下拉列表验证；被筛选掉的行写成隐藏行 |
| 其他       | 批注；单元格类型写入它的 `plain` 值，比如评分写成数字                                                              |

导出选区时只写值、样式和选区里的合并单元格，选区从文件的 A1 开始；条件格式、数据验证、筛选、冻结、分组和批注都不写。

有些内容文件放不下，会换一种写法：

- 表格软件要求工作表名不超过 31 个字符、不含 `[]:*?/\`、首尾不是 `'`。不符合的名字会截断，不允许的字符换成 `_`；这样改过以后和别的工作表重名的，名字后面加上序号。公式、条件格式和数据验证里对这张表的引用会一起改。
- 下拉选项或列表验证的某个值里有逗号或引号时，文件里的列表会把它拆开，这条列表验证就不写。
- 公式依赖自己（`#CYCLE!`）时，结果写成 `#VALUE!`；结果不是有限的数时写成 `#NUM!`；写错的公式按文字写入。

## 大文件

10 万行 × 20 列的工作表在桌面浏览器里大约 2 秒导出完，文件约 4 MB。生成和压缩都是一段一段做的，每段约 50 毫秒，段与段之间让页面处理输入和绘制，传入的 `signal` 取消时会在下一段停下。
