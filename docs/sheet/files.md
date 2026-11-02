# 导入导出

表格自带 CSV 的导入导出，以及导出 PNG、SVG 图片和打印。`.xlsx` 文件用 [`@dou-ui/sheet-xlsx`](./xlsx)，其他格式可以通过扩展加入，见[导出器与导入器](./exporters)。

## 导出菜单

工具栏的 `export` 是导出菜单，`import` 是导入按钮，默认不在工具栏上，用 `tools` 加上：

```vue-html
<DouSheetToolbar :tools="['undo', 'redo', '|', 'bold', 'italic', '|', 'import', 'export']" />
```

<DocDemo src="sheet/csv" column />

- 导出菜单列出所有导出方式，选中后直接下载文件。一种方式能导出不止一种范围时（比如 CSV 可以导出整张表或只导出选区），菜单项展开子菜单让用户选。
- 导入按钮打开文件选择框，读入的文件作为新工作表加在最后。
- 下载的文件名默认取导出的工作表名。工具栏的 `fileName` 传字符串时，后面会自动加上扩展名；传函数 `(exporter, scope) => string` 时，返回完整的文件名。

```vue-html
<DouSheetToolbar :tools="['import', 'export']" file-name="预算-2026-11" />
```

自带的导出方式：`csv`（当前工作表或选区）、`png` 和 `svg`（当前工作表或选区画成图片）。自带的导入方式：CSV 和制表符分隔的文本。

## 用代码导入导出

```ts
// 返回 Blob，下载与否由你决定
const blob = await grid.value.exportFile('csv', { scope: 'selection' })
// 导出并下载，和工具栏一样；文件名默认取工作表名
await grid.value.saveFile('png', { fileName: '门店.png' })
// 读入文件，返回读到的内容；没有写入时返回 null
await grid.value.importFile(file, { mode: 'replace' })
```

按名字调用时，`options` 按导出方式检查类型，比如 `exportFile('csv', { options: { delimter: ';' } })` 会报类型错误。

`importFile` 的 `mode` 决定读入的内容放在哪里，三种都能一步撤销：

- `'append'`（默认）：作为新工作表加在最后。和已有工作表重名时加上序号，文件里指向它的公式、条件格式和数据验证跟着改名。样式和单元格类型与已有的同名但内容不同时也自动改名。
- `'replace'`：换掉所有工作表，样式和单元格类型也换成文件里的。
- `'insert'`：把第一张工作表的内容从当前单元格开始放一份，带着格式、样式和单元格类型，公式像粘贴一样跟着移动。

导入时默认按文件名、类型和开头的内容找第一个能读的导入方式。只读时不能导入。导入产生的事务 `action` 都是 `'import'`。

## 拖入文件

设置 `fileDrop` 后，把文件拖到表格上会读入它。拖动经过时高亮将要放入的单元格，松开后，第一张工作表的内容从这一格开始放入。一次拖入多个文件时只读第一个。

## 导入事件

读完、写入之前触发 `import` 事件，事件里有 `file`、`importer`、`mode`、读到的 `book` 和 `warnings`（没能带过来的内容，比如边框）。可以修改 `book`，或者调用 `preventDefault()` 不写入。

要先让用户确认时，先 `preventDefault()`，等用户同意后再调用 `event.apply()`，按原来的 `mode` 写入，只能写入一次：

```ts
import type { SheetImportEvent } from '@dou-ui/sheet'
import { dialog } from 'dou-ui'

async function onImport(event: SheetImportEvent) {
  if (!event.warnings.length) return
  event.preventDefault()
  if (await dialog.confirm(`有 ${event.warnings.length} 处内容没能导入，继续吗？`)) event.apply()
}
```

## 出错时

导入或保存文件失败时，表格下方显示一条简短的提示，同时触发 `fileError` 事件。失败的情况包括没有能读这个文件的导入方式、导入方式出错、导出的图片太大。

- 事件里有 `action`（`'import'` 或 `'export'`）、`file`、`importer` 或 `exporter`、`error`，以及表格要显示的提示文字 `message`。
- 在事件里调用 `preventDefault()`，表格不再显示自带的提示，读屏仍会播报。
- `error` 是给开发者看的英文错误，不要直接显示给用户。导入器抛出的 `SheetFileError` 还带有 `code` 和给用户看的 `reason`。
- 用代码调用时，`importFile` 和 `saveFile` 失败时返回的 Promise 也会 reject。`exportFile` 失败时不显示提示，也不触发 `fileError`，由调用方自己 `catch`。

```ts
import type { SheetFileErrorEvent } from '@dou-ui/sheet'
import { toast } from 'dou-ui'

function onFileError(event: SheetFileErrorEvent) {
  event.preventDefault()
  toast.danger(event.message)
}
```

## CSV

组件实例的 `toCSV()` 把当前工作表写成 CSV。默认写其他表格软件能排序、求和的值：

- 数字不带格式（`1280`），日期写成 `2026-03-05`，公式写计算结果，单元格类型按它的 `plain` 写。
- 只写到最后一个有数据的行和列，`range` 可以只导出一部分，`sheet` 指定别的工作表。
- 开头默认带字节顺序标记，表格软件打开时中文不会乱码。

`text: true` 改为写单元格显示的文字，比如 `¥1,280.00`、`2026年3月5日`。

以 `=`、`+`、`-`、`@`、制表符或回车开头的文字在表格软件里打开时会被当成公式执行，可能被用来插入恶意链接或命令，所以导出时默认在这样的文字前加上 `'`，数字不受影响。

- `formulas: true` 时公式按原文写出，不加 `'`，可以用 `readCSV(text, { formulas: true })` 读回来。
- 确定文件不会被表格软件打开，或者只是给 `readCSV` 原样读回时，设置 `escapeFormulas: false`。

## 读取 CSV

`readCSV(text, options?)` 把 CSV 读成二维数组，可以直接作为工作表的 `cells`，比如 `tr.addSheet({ name, cells: readCSV(text) })`。

- 数字、日期、百分比和 `TRUE` / `FALSE` 按输入时的规则识别，比如 `2026/3/5` 读成日期并保留写法。
- `007`、很长的卡号这类带前导零或超过 15 位的数字保持文字，以免丢失。
- 以 `=` 开头的内容默认按文字读入（存成 `'=…`），不会变成公式。

`parseCSV(text, delimiter?)` 只拆分字段，不识别类型；`detectDelimiter(text)` 返回判断出的分隔符。

不经过组件时，`sheetToCSV(sheetData, options)` 把工作表数据写成 CSV。公式要用 `result` 给出结果才能写成计算结果（见[公式](./formulas)），没有 `result` 时公式当作文字写出，前面加 `'`。

## 导出图片与打印

组件实例的 `exportSVG()` 和 `exportPNG()` 把当前工作表画成图片，`print()` 打印整张工作表。

<DocDemo src="sheet/export" column />

图片和表格里的样子一致：

- 样式、合并单元格、条件格式的颜色和数据条、勾选框和选项标签都会画出来，颜色跟随当前的亮暗主题。
- 选区、隐藏的行列和被筛选掉的行不会画出来。
- 自定义的单元格类型按 `format` 返回的文字画出，或者用类型的 `draw` 画出。

`exportSVG()` 返回 SVG 文档的字符串，文字仍是文字，可以在设计软件里继续编辑；`exportPNG()` 返回 PNG 的 `Blob`。方法只返回内容，要和工具栏一样直接下载，可以用 `saveFile('png')`，或者 `dou-ui` 的 `downloadBlob`：

```ts
import { downloadBlob } from 'dou-ui'

downloadBlob(await grid.value.exportPNG(), '门店.png')
```

浏览器对画布的尺寸有限制，区域很大时 `exportPNG()` 自动降低 `pixelRatio`，降到 1 仍然放不下时抛出 `RangeError`，不会生成一张模糊的图。这时可以用 `range` 分几次导出，或者改用 `exportSVG()`、`toCSV()`。

表格只渲染看得见的部分，直接打印页面只能打出一屏。`print()` 会打印整张表：

- 纸张是 A4，表格比竖向的纸宽时自动横向。
- 一页放不下时按先向下、再向右的顺序分页，冻结的行和列在每一页重复，页脚有页码。
- 打印总是使用浅色主题。

## API

### exportFile 选项

| 名称      | 说明                                                                        | 默认值               |
| --------- | --------------------------------------------------------------------------- | -------------------- |
| `scope`   | 导出什么：`'workbook'` 整个工作簿、`'sheet'` 一张工作表、`'selection'` 选区 | 导出方式支持的第一种 |
| `sheet`   | 工作表，序号、`id` 或名字                                                   | 当前显示的           |
| `range`   | 只导出这片区域，如 `'A1:F20'`                                               | 选区或有数据的部分   |
| `options` | 交给导出方式的选项，比如 CSV 的 `{ delimiter, bom, text, formulas }`        | —                    |
| `signal`  | 取消导出用的 `AbortSignal`                                                  | —                    |

`saveFile` 的选项相同，另外有 `fileName`。

### importFile 选项

| 名称       | 说明                                                               | 默认值       |
| ---------- | ------------------------------------------------------------------ | ------------ |
| `mode`     | 读入的内容放在哪里：`'append'`、`'replace'` 或 `'insert'`          | `'append'`   |
| `importer` | 用哪种导入方式，按名字                                             | 第一个能读的 |
| `signal`   | 取消导入用的 `AbortSignal`，取消后不再写入；表格卸载时也会自动取消 | —            |
| `options`  | 交给导入方式的选项                                                 | —            |

### toCSV 选项

| 名称             | 说明                                                                                          | 默认值       |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `sheet`          | 要导出的工作表，序号、`id` 或名字                                                             | 当前显示的   |
| `range`          | 只导出这片区域，如 `'A1:D20'`、`'B:D'`                                                        | 有数据的部分 |
| `delimiter`      | 分隔符                                                                                        | `','`        |
| `text`           | 写单元格显示的文字，而不是值                                                                  | `false`      |
| `formulas`       | 公式按原文写出，而不是计算结果；`text` 时不起作用                                             | `false`      |
| `newline`        | 行之间的换行                                                                                  | `'\r\n'`     |
| `bom`            | 在开头加上字节顺序标记                                                                        | `true`       |
| `escapeFormulas` | 在以 `=`、`+`、`-`、`@`、制表符或回车开头的文字前加 `'`                                       | `true`       |
| `locale`         | `text` 时日期格式里星期等文字的语言                                                           | 当前语言     |
| `cellText`       | `(input, value, row, col) => string \| undefined`，`text` 时自己决定写出的文字                | —            |
| `cellPlain`      | `(input, value, row, col) => value \| undefined`，不带 `text` 时自己决定写出的值；`null` 写空 | —            |

工具栏的导出菜单和 `exportFile('csv', { options })` 能用其中的 `delimiter`、`text`、`formulas`、`newline`、`bom`、`escapeFormulas`。

### readCSV 选项

| 名称        | 说明                                                   | 默认值                               |
| ----------- | ------------------------------------------------------ | ------------------------------------ |
| `delimiter` | 分隔符                                                 | 从内容判断：逗号、分号、制表符或竖线 |
| `typed`     | 识别数字、日期等；`false` 时所有内容都是文字           | `true`                               |
| `decimal`   | 小数点。`','` 时 `1,5` 读成 1.5、`1.280,5` 读成 1280.5 | 分隔符是 `;` 时为 `','`，否则 `'.'`  |
| `formulas`  | 以 `=` 开头的内容读成公式                              | `false`                              |

### 图片与打印选项

| 名称          | 说明                                                  | 默认值                   |
| ------------- | ----------------------------------------------------- | ------------------------ |
| `sheet`       | 要画的工作表，序号、`id` 或名字，不必先切换过去       | 当前显示的               |
| `range`       | 只画这片区域，如 `'A1:F20'`、`'A:D'`                  | 有数据和合并单元格的部分 |
| `headers`     | 画出列标和行号                                        | `false`                  |
| `gridlines`   | 画出格线                                              | 跟随表格的 `gridlines`   |
| `background`  | 填充底色；`false` 时为透明底（仅图片）                | `true`                   |
| `pixelRatio`  | 每个 CSS 像素对应的图片像素（仅 `exportPNG`）         | `2`                      |
| `title`       | 每页顶部的标题（仅 `print`）                          | —                        |
| `orientation` | 纸张方向，`'portrait'` 或 `'landscape'`（仅 `print`） | 按表格宽度选择           |
