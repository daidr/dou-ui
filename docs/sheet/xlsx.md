# 导入导出 xlsx

`@dou-ui/sheet-xlsx` 是电子表格的一个扩展，把工作簿写成 `.xlsx` 文件，也能把 `.xlsx` 文件读成工作簿，常见的表格软件都能打开它写的文件。它不依赖其他库，压缩和解压用的是运行环境自带的 `CompressionStream` 和 `DecompressionStream`：2023 年以后的主流浏览器、Node 18 以上、Bun 和 Deno 都有，没有时会报错并说明原因。

## 安装

```sh
bun add @dou-ui/sheet-xlsx
```

## 基础用法

把 `xlsx()` 加到表格的 `extensions` 里，工具栏的导出菜单就会多出 XLSX，导入按钮和拖入文件也能读 `.xlsx` 文件：

```vue
<script setup lang="ts">
import { DouSheet, DouSheetToolbar, type SheetWorkbook } from '@dou-ui/sheet'
import { xlsx } from '@dou-ui/sheet-xlsx'
import { ref } from 'vue'

const book = ref<SheetWorkbook>({
  version: 1,
  sheets: [{ name: '门店', cells: [['上海静安', 186400]] }],
})
const extensions = [xlsx()]
</script>

<template>
  <DouSheet v-model="book" :extensions="extensions">
    <template #header>
      <DouSheetToolbar :tools="['import', 'export']" />
    </template>
  </DouSheet>
</template>
```

<DocDemo src="sheet/xlsx" column />

## 导出

可以导出整个工作簿、当前工作表或选区。工具栏的导出菜单里，XLSX 有子菜单，可以选择整个工作簿或当前工作表，选中了一片区域时还可以选择选区。用代码导出时和其他导出方式一样，默认导出整个工作簿：

```ts
// 导出并下载
await grid.value.saveFile('xlsx', { fileName: '门店营收.xlsx' })
// 只要 Blob
const blob = await grid.value.exportFile('xlsx', { scope: 'sheet', options: { formulas: false } })
```

不经过组件时，把 `xlsxExporter` 交给 `exportWorkbook`，在脚本、Worker 或服务端都能用。`exportWorkbook` 从[不含组件的入口](./extensions#不含组件的入口) `@dou-ui/sheet/core` 引入，`@dou-ui/sheet-xlsx` 也不引入组件和图标，Worker 里就不会加载 Vue。表格的 `colWidth`、`rowHeight` 不是默认的 96、28 时，在这里一并传入，文件里的列宽行高才和表格一致：

```ts
import { exportWorkbook } from '@dou-ui/sheet/core'
import { xlsxExporter } from '@dou-ui/sheet-xlsx'

const blob = await exportWorkbook(book, xlsxExporter, { colWidth: 120 })
```

`writeXlsx(source, options?)` 是 `xlsxExporter` 写文件的那一步，返回文件的字节。自己写导出器、想在别的格式之外再附带一份 `.xlsx` 时可以直接调用，`source` 就是导出器拿到的那个。

## 选项

选项可以在 `xlsx(options)` 里给出，作为每次导出和导入的默认值；`exportFile`、`importFile` 的 `options` 会覆盖它们。

| 名称       | 说明                                                                                                                                                                                           | 默认值                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `formulas` | 导出时写入公式和计算结果，`false` 时只写结果，适合用了扩展函数、其他软件算不出来的公式，导出选区时总是只写结果；导入时读入公式，`false` 时只读文件里存的计算结果，适合用了表格没有的函数的文件 | `true`                             |
| `messages` | 导入时的警告和错误文字，只给要换的几条，如 `{ warnings: { border: '框线' } }`；也可以借此加上表格没有的语言                                                                                    | 跟随表格的语言                     |
| `label`    | 导出菜单里的名字，也是导入提示里这种文件的叫法（只在 `xlsx()` 里）                                                                                                                             | 由表格文案 `file.csv` 得出，见下文 |

导出菜单里的名字默认由表格的文案 `file.csv` 得出，把其中的“CSV”换成“XLSX”、`.csv` 换成 `.xlsx`，如 `CSV 文件 (.csv)` 得出 `XLSX 文件 (.xlsx)`。改过 `file.csv`、里面不再有“CSV”时，名字是 `XLSX (.xlsx)`，这时用 `label` 指定。

## 写进文件的内容

| 内容       | 说明                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 值         | 数字、文字、布尔值；日期和时间写成日期值，带上它的格式，没有格式时是 `yyyy-mm-dd`、`hh:mm`。公式算出的日期也一样   |
| 公式       | 公式和计算结果，打开时会重新计算；文字形式的 `=…`（存为 `'=…`）写成文字，在其他软件里编辑后仍是文字                |
| 格式与样式 | 数字格式；粗体、斜体、下划线、删除线、文字颜色、底色、对齐和换行。`tone`、`fill` 换成浅色主题下的颜色              |
| 布局       | 合并单元格、冻结的行列、列宽行高、隐藏的行列；分组写成分级显示，折叠的组隐藏                                       |
| 规则       | 条件格式（色阶、数据条也会写入）、数据验证、筛选；单元格类型是下拉选项的，写成下拉列表验证；被筛选掉的行写成隐藏行 |
| 链接与保护 | 单元格的链接和 `HYPERLINK` 公式；工作表保护和放开的选项、未锁定的单元格、工作簿结构保护，都不带密码                |
| 其他       | 批注；单元格类型写入它的 `plain` 值，比如评分写成数字                                                              |

导出选区时只写值、样式和选区里的合并单元格，选区从文件的 A1 开始；条件格式、数据验证、筛选、冻结、分组和批注都不写。

有些内容文件放不下，会换一种写法：

- 表格软件要求工作表名不超过 31 个字符、不含 `[]:*?/\`、首尾不是 `'`。不符合的名字会截断，不允许的字符换成 `_`；这样改过以后和别的工作表重名的，名字后面加上序号。公式、条件格式和数据验证里对这张表的引用会一起改。
- 下拉选项或列表验证的某个值里有逗号或引号时，文件里的列表会把它拆开，这条列表验证就不写。
- 公式依赖自己（`#CYCLE!`）时，结果写成 `#VALUE!`；结果不是有限的数时写成 `#NUM!`；写错的公式按文字写入。

## 导入

加了 `xlsx()` 以后，工具栏的导入按钮、拖入文件和 `importFile` 都能读 `.xlsx` 文件，写入方式（追加、替换、从当前单元格放入）和其他文件一样，见[导入与导出](./index#导入与导出)。读完、写入之前触发的 `import` 事件里，`warnings` 列出文件里有、表格放不下的内容，可以据此提示用户：

```ts
import type { SheetImportEvent } from '@dou-ui/sheet'
import { toast } from 'dou-ui'

function onImport(event: SheetImportEvent) {
  if (event.warnings.length)
    // 多个工作表会有同一种内容，去掉重复的
    toast.warning(`与原文件不同：${[...new Set(event.warnings.map((w) => w.message))].join('、')}`)
}
```

不经过组件时，把 `xlsxImporter` 交给 `readWorkbook`，得到 `{ book, warnings }`；也可以直接调用 `readXlsx(file, options?)`，`file` 可以是 `Blob`、`ArrayBuffer` 或 `Uint8Array`，`options` 里除了上面的 `formulas`、`messages`，还有 `locale`（警告和错误用的语言）和 `signal`：

```ts
import { readWorkbook } from '@dou-ui/sheet/core'
import { readXlsx, xlsxImporter } from '@dou-ui/sheet-xlsx'

const { book, warnings } = await readWorkbook(file, xlsxImporter)
// 或者
const result = await readXlsx(await file.arrayBuffer(), { locale: 'en' })
```

读进来的内容和写进文件的内容一一对应：值、公式、数字格式、样式、合并单元格、冻结的行列、列宽行高、隐藏的行列、分级显示（读成分组）、批注、链接、数据验证、条件格式、筛选和保护。有几处会换成表格的写法：

- 日期和时间读成 `2026-03-05`、`2026-03-05 09:30`、`09:30` 这样的文字，格式不是这种写法时保留格式，比如 `yyyy/m/d`。
- 样式按文件里不同的样子读成工作簿的命名样式 `style1`、`style2`……；文件里的默认字色和底边对齐不算样式。主题颜色换成具体的颜色。
- 新函数的前缀（如 `_xlfn.XLOOKUP`）会去掉；共享公式读成每个单元格自己的公式。
- 被筛选掉的行不读成隐藏行，筛选会再次把它们隐藏；折叠的分组读成折叠，不另记为隐藏。
- 条件格式按文件里的优先级排好，先写的先生效。
- 指向网址和工作簿里单元格的链接读成单元格的 `link`；文件里一个链接覆盖一片区域时，区域里的每个单元格都带上它。
- 工作表和工作簿结构的保护照常读入，密码不读，读入后任何人都能取消保护。

表格放不下、或者读进来和原文件不一样的内容，按种类和工作表列在 `warnings` 里，每项是 `{ code, message, count, sheet }`。`message` 是跟随语言的简短名称，比如“边框”，适合列在一起提示；它们各自怎么处理见下表：

| `code`        | 内容                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `border`      | 边框                                                                                                           |
| `font`        | 不同的字号（字体在不同电脑上本来就不同，不计入）                                                               |
| `richText`    | 单元格里部分文字的格式，文字本身会读入                                                                         |
| `image`       | 图片和形状                                                                                                     |
| `chart`       | 图表，包括只有图表的工作表                                                                                     |
| `pivot`       | 数据透视表，它算出的值会读入                                                                                   |
| `table`       | 表格对象（如 `Table1`），里面的数据会读入；按名称引用它的公式（如 `=SUM(Table1[数量])`）读成文件里存的计算结果 |
| `macro`       | 宏                                                                                                             |
| `hyperlink`   | 指向其他文件或打不开的地址的超链接，单元格的文字会读入                                                         |
| `password`    | 工作表和工作簿保护的密码，保护本身会读入                                                                       |
| `hiddenSheet` | 隐藏的工作表，读入后会显示出来                                                                                 |
| `external`    | 引用其他文件的公式，读成文件里存的计算结果                                                                     |
| `name`        | 定义的名称，用到它们的公式会显示错误                                                                           |
| `conditional` | 表格没有的条件格式，如图标集                                                                                   |
| `validation`  | 表格没有的数据验证，如文本长度                                                                                 |
| `filter`      | 表格没有的筛选条件，如按颜色筛选                                                                               |

文件读不了时，导入会失败，抛出 [`SheetFileError`](./extensions#导出器与导入器)。它的 `code` 区分原因，`reason` 是给用户看的说明，跟随语言，表格的提示里显示的就是它；`message` 是给开发者看的英文：

| `code`    | 原因                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------- |
| `notXlsx` | 不是 `.xlsx` 文件，比如旧的 `.xls`（即使改了扩展名），这时可以提示用户在原来的软件里另存为 `.xlsx` |
| `damaged` | 文件已损坏                                                                                         |
| `locked`  | 文件设了密码                                                                                       |

```ts
import { SheetFileError, type SheetFileErrorEvent } from '@dou-ui/sheet'
import { toast } from 'dou-ui'

function onFileError(event: SheetFileErrorEvent) {
  if (event.error instanceof SheetFileError && event.error.code === 'notXlsx') {
    event.preventDefault()
    toast.error('请在原来的软件里另存为 .xlsx 文件后再导入')
  }
}
```

## 大文件

10 万行 × 20 列的工作表在桌面浏览器里大约 2 秒导出完，文件约 4 MB；读入同样的文件大约 1.5 秒。生成、压缩、解压和读取都是一段一段做的，每段约 50 毫秒，段与段之间让页面处理输入和绘制，传入的 `signal` 取消时会在下一段停下。
