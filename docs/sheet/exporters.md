# 导出器与导入器

导出器把工作簿写成一种文件，导入器把一种文件读成工作簿。用扩展的 `exporters`、`importers` 加入后，它们出现在工具栏的导出菜单和导入按钮里，也能用 `exportFile`、`importFile` 按名字调用，见[导入导出](./files)。

导出器和导入器只读写数据，不依赖表格组件，所以也可以在脚本、Worker 或服务端使用。

## 导出器

下面加了一个导出 JSON 的导出器，打开工具栏的导出菜单可以看到它。

<DocDemo src="sheet/exporter" column />

```ts
import { defineSheetExporter, defineSheetExtension } from '@dou-ui/sheet'

const json = defineSheetExporter({
  name: 'json',
  label: 'JSON (.json)',
  extension: 'json',
  mime: 'application/json',
  scopes: ['workbook', 'sheet'],
  export: (source) => JSON.stringify(source.sheets.map((s) => s.data)),
})

const extensions = [defineSheetExtension({ name: 'json', exporters: [json] })]
```

- 和内置的 `csv`、`png`、`svg` 同名时替换内置的，在菜单里留在原来的位置。
- `scopes` 的第一项是默认的范围；有多种时，导出菜单让用户选。
- 不写 `icon` 时，导出菜单按 `extension` 给一个文件图标，比如 `.xlsx` 是表格文件的图标。

`export` 收到的 `source` 是导出时的工作簿和读取单元格的方法，见下方 [SheetFileSource](#sheetfilesource)。要按表格画出来的样子导出（列宽、行高、页面主题的颜色）时，设置 `needs: 'view'`，就能拿到 `source.view`，这样的导出器只能在表格组件里用。

想让 `exportFile('json', { options })` 检查选项的类型，把选项补进 `SheetExporterOptions`：

```ts
declare module '@dou-ui/sheet' {
  interface SheetExporterOptions {
    json: { indent?: number }
  }
}
```

## 样式与颜色

`source.style` 给出的是叠加了条件格式的样子。要把样式写成文件自己的格式时，可以读 `book.styles` 里的命名样式：

- `plainStyle(style)` 把 `tone`、`fill` 换成浅色主题下的 `color`、`background`。
- `lightThemeColor(css)` 把主题变量和 `color-mix(in oklab, …)` 算成 `#rrggbb`，其他颜色原样返回。

```ts
import { lightThemeColor, plainStyle } from '@dou-ui/sheet'

plainStyle({ bold: true, fill: 'primary' }) // { bold: true, background: '#e6eaf7' }
lightThemeColor('var(--dou-color-danger)') // '#b2423e'
```

[`@dou-ui/sheet-xlsx`](./xlsx) 用它们把条件格式写成文件里的规则。

## 导入器

导入器读文件，返回 `{ book, warnings? }`。`warnings` 列出没能带过来的内容，会在 `import` 事件里交给使用者。

```ts
import { defineSheetImporter } from '@dou-ui/sheet'

const json = defineSheetImporter({
  name: 'json',
  label: 'JSON',
  accept: ['.json', 'application/json'],
  async import(file) {
    return { book: { version: 1, sheets: JSON.parse(await file.text()) } }
  },
})
```

- 扩展的导入器比内置的 CSV 先询问。默认按文件名、类型和开头的内容找第一个能读的导入器。
- `sniff` 按文件开头的字节判断能不能读，用于文件名看不出来的情况。

读不了文件时，抛出 `SheetFileError(message, code, reason)`：

- `reason` 是给用户看的原因，跟随 `context.locale`，表格的提示里显示它。
- `message` 是给开发者看的英文。
- `code` 让使用者在 `fileError` 事件里区分情况。

```ts
import { SheetFileError } from '@dou-ui/sheet/core'

throw new SheetFileError('[my-importer] The file is empty.', 'empty', '文件是空的')
```

抛出普通的 `Error` 时，提示里显示它的 `message`。

## 不经过组件

- `exportWorkbook(book, exporter, options?)` 写出 `Blob`，会计算公式。`needs: 'view'` 的导出器在这里会报错。
- `readWorkbook(file, importer, options?)` 只读出 `{ book, warnings }`，不写进任何表格。
- 内置的 CSV 导出器和导入器是 `csvExporter`、`csvImporter`。

```ts
import { csvExporter, exportWorkbook } from '@dou-ui/sheet/core'

const blob = await exportWorkbook(book, csvExporter, { scope: 'sheet', sheet: 1 })
```

`exportWorkbook` 的 `options`：

- `scope`、`sheet`（序号、`id` 或名字，默认第一张）、`range`、`signal` 和组件的 `exportFile` 一样。
- `extensions` 提供工作簿用到的单元格类型和函数。
- `colWidth`、`rowHeight` 是没有单独设过大小的列宽、行高，默认 96、28。
- `options` 交给导出器。

## 不含组件的入口

`@dou-ui/sheet` 带着表格组件，引入它就会加载 Vue 和组件。在 Worker 或服务端只读写数据时，从 `@dou-ui/sheet/core` 引入，它不加载 Vue，也不加载任何组件：

| 内容         | 导出                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 文件读写     | `exportWorkbook`、`readWorkbook`、`createFileSource`、`csvExporter`、`csvImporter`、`defineSheetExporter`、`defineSheetImporter` |
| 单元格与区域 | `parseCell`、`parseRange`、`formatCell`、`formatRange`、`columnName`、`quoteSheet`、`renameReferencesAll` 等                     |
| 值与样式     | `cellOf`、`valueOf`、`formatValue`、`parseInput`、`meetsRule`、`plainStyle`、`lightThemeColor` 等                                |
| 修改         | `SheetTransaction`、`applySheetSteps`、`compactSheetSteps`、`sheetKey`                                                           |
| 单元格类型   | `defineSheetCellType`、`optionOf`                                                                                                |
| 扩展         | `defineSheetExtension`                                                                                                           |
| 文案         | `sheetMessagesFor`、`sheetLocales`                                                                                               |

这些在 `@dou-ui/sheet` 里也都有，在页面里用哪个都一样。公式引擎在 [`@dou-ui/sheet/formula`](./formulas#单独使用计算引擎)，同样不含组件。

```ts
// export.worker.ts
import {
  csvExporter,
  defineSheetCellType,
  defineSheetExtension,
  exportWorkbook,
  type SheetWorkbook,
} from '@dou-ui/sheet/core'

// 工作簿用到的单元格类型，和页面里交给表格的一样
const stars = defineSheetCellType({
  name: 'stars',
  format: (value) => '★'.repeat(Number(value)),
  plain: (value) => Number(value),
})
const extensions = [defineSheetExtension({ name: 'stars', cellTypes: [stars] })]

self.onmessage = async (event: MessageEvent<SheetWorkbook>) => {
  self.postMessage(await exportWorkbook(event.data, csvExporter, { extensions }))
}
```

在 Worker 里使用时：

- 导出器不要写 `icon`。图标是 Vue 组件，不写时 Worker 不会加载图标和 Vue。
- 扩展和单元格类型的部分字段用到了 Vue 和 DOM 的类型，所以 `tsconfig.json` 只写 `"lib": ["WebWorker"]` 时，要开启 `skipLibCheck`（Vite 创建的项目默认开启），或者在 `lib` 里加上 `"DOM"`。

## API

### SheetExporter

| 名称        | 说明                                                    | 类型                                                              |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `name`      | 名字，`exportFile(name)` 用它；两个扩展不能重名         | `string`                                                          |
| `label`     | 导出菜单里的名字                                        | `string \| ((messages) => string)`                                |
| `icon`      | 导出菜单里的图标；不写时按 `extension` 给一个文件图标   | `Component`                                                       |
| `extension` | 文件扩展名，不带点                                      | `string`                                                          |
| `mime`      | 文件类型，`export` 返回字符串时用它包成 `Blob`          | `string`                                                          |
| `scopes`    | 能导出什么，第一个是默认的范围；默认三种都可以          | `('workbook' \| 'sheet' \| 'selection')[]`                        |
| `needs`     | `'view'` 表示按表格画出来的样子导出，只能在表格组件里用 | `'data' \| 'view'`，默认 `'data'`                                 |
| `export`    | 写出文件，`options` 是 `exportFile` 传入的 `options`    | `(source, options?) => Blob \| string \| Promise<Blob \| string>` |

### SheetFileSource

单元格都用工作表序号、行、列（从 0 开始）指定。

| 名称                        | 说明                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `book`                      | 存储的工作簿                                                                                |
| `scope`                     | 这次导出的范围                                                                              |
| `sheets`                    | 要写的工作表，每项是 `{ index, data, bounds }`，`bounds` 是要写的单元格，空表为 `null`      |
| `value(sheet, row, col)`    | 存储的值，公式单元格是公式本身                                                              |
| `result(sheet, row, col)`   | 计算结果，错误是 `SheetError`                                                               |
| `text(sheet, row, col)`     | 单元格显示的文字，和表格里一致                                                              |
| `plain(sheet, row, col)`    | 写给其他表格软件的值：单元格类型的 `plain`，或计算结果（错误写成 `#DIV/0!` 这样的代码）     |
| `style(sheet, row, col)`    | 单元格的样子：命名样式叠加条件格式；`tone`、`fill` 已换成浅色主题下的 `color`、`background` |
| `format(sheet, row, col)`   | 数字格式                                                                                    |
| `cellType(sheet, row, col)` | 单元格类型，普通单元格为 `undefined`                                                        |
| `locale`、`messages`        | 语言和文案                                                                                  |
| `colWidth`、`rowHeight`     | 默认的列宽、行高（px）                                                                      |
| `signal`                    | `exportFile` 传入的 `signal`，取消时中止                                                    |
| `view`                      | 只有 `needs: 'view'` 时才有：`view.drawing(options?)` 返回按表格画出来的布局和颜色          |

### SheetImporter

| 名称     | 说明                                                                 | 类型                                                                           |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `name`   | 名字，`importFile(file, { importer })` 用它                          | `string`                                                                       |
| `label`  | 这种文件叫什么，比如“CSV 文件”；用在提示和 `useSheet().importers` 里 | `string \| ((messages) => string)`                                             |
| `accept` | 能读的文件，写法和文件选择框的 `accept` 一样                         | `string[]`                                                                     |
| `sniff`  | 按文件开头的字节判断能不能读                                         | `(head: Uint8Array) => boolean`                                                |
| `import` | 读文件；`context` 里有 `messages`、`locale` 和 `signal`              | `(file, context, options?) => SheetImportResult \| Promise<SheetImportResult>` |
