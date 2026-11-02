# 电子表格

`@dou-ui/sheet` 提供电子表格 `DouSheet`，用于预算表、排班表、数据录入这类按单元格填写的界面。只需要按列展示一组记录时，使用 [Table 表格](/components/table)。

完整的页面示例见区块[部门预算](../blocks/budget)和[门店排班](../blocks/shifts)。

## 安装

电子表格是单独的包，需要和 `dou-ui` 一起安装：

```sh
bun add dou-ui @dou-ui/sheet
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/sheet/style.css'
import { DouSheet } from '@dou-ui/sheet'

app.use(DouSheet)
```

## 基础用法

`v-model` 绑定一个工作簿：`sheets` 是工作表列表，每张表的 `cells` 是按行排列的二维数组。只有值的单元格直接写值，需要样式或数字格式时写成对象。完整的格式见[文档数据](./data)。

<DocDemo src="sheet/basic" column />

- 数字、日期和时间靠右，文字靠左，`TRUE` / `FALSE` 居中。
- 没有数字格式的数字放不下时，先减少小数位，再改用科学计数法（如 `1.23E+11`）显示，加宽列后恢复。对齐和这些显示方式都不改变值本身。

## 只读

`readonly` 让使用者只能选择、浏览和复制，不能修改。代码调用组件实例的 `transact`、`undo`、`redo` 不受 `readonly` 限制，见[用代码修改](./transactions)。

## 外观

- `rowHeight`、`colWidth` 设置默认的行高和列宽。
- `headers` 控制是否显示列标和行号，`gridlines` 控制单元格之间的细线，`outline` 控制分组的大纲栏。
- 表格默认高 480px，用 `style` 或 CSS 修改。

## 冻结行列

工作表的 `freeze` 让前几行、前几列在滚动时固定在顶部和左侧，适合表头和名称列。滚动之后，冻结的边线旁会出现一道浅阴影。

<DocDemo src="sheet/freeze" column />

工具栏的冻结按钮可以冻结首行、首列，或冻结到当前单元格，见[工具栏](./toolbar)。

## 大量数据

表格横向和纵向都只渲染看得见的单元格。下面是 1 万行 × 20 列、共 20 万个单元格的表：

<DocDemo src="sheet/large" column />

- 修改只复制改动的那一行，其余行原样共享，所以只有改动的行会重新绘制。
- 每次修改都返回新的行数组，不改动原来的数据，所以用 `shallowRef` 保存工作簿即可。用 `ref` 也能正常工作。

## API

### Sheet Props

| 名称                    | 说明                                                         | 类型                                     | 默认值  |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------- | ------- |
| `v-model`               | 工作簿，见[文档数据](./data)                                 | `SheetWorkbook`                          | —       |
| `v-model:selection`     | 选区，见[选择与编辑](./editing#选择)                         | `SheetSelection`                         | —       |
| `v-model:activeSheet`   | 显示的工作表的序号，见[工作表](./toolbar#多个工作表)         | `number`                                 | `0`     |
| `readonly`              | 只读：可以选择和复制，不能修改                               | `boolean`                                | `false` |
| `rowHeight`             | 默认行高（px）                                               | `number`                                 | `28`    |
| `colWidth`              | 默认列宽（px）                                               | `number`                                 | `96`    |
| `headers`               | 显示列标和行号                                               | `boolean`                                | `true`  |
| `outline`               | 显示分组的大纲栏，见[分组](./rows#分组)                      | `boolean`                                | `true`  |
| `gridlines`             | 显示单元格之间的细线                                         | `boolean`                                | `true`  |
| `historyDepth`          | 最多能撤销多少步                                             | `number`                                 | `100`   |
| `menu`                  | 修改右键菜单，见[右键菜单](./rows#右键菜单)                  | `(items, context) => SheetMenuItem[]`    | —       |
| `extensions`            | 扩展，见[扩展](./extensions)                                 | `(SheetExtension \| SheetExtension[])[]` | `[]`    |
| `fileDrop`              | 拖到表格上的文件用导入器读入，见[导入导出](./files#拖入文件) | `boolean`                                | `false` |
| `v-model:comments`      | 所有讨论，见[评论](./comments)                               | `CommentThread[]`                        | —       |
| `author`                | 当前用户，见[评论](./comments)                               | `CommentAuthor`                          | —       |
| `v-model:activeComment` | 打开的讨论，见[评论](./comments)                             | `string \| null`                         | —       |
| `commentable`           | 能否发起和回复讨论                                           | `boolean`                                | `true`  |
| `compare`               | 要对比的旧版本，见[历史版本](./versions)                     | `SheetWorkbook \| null`                  | —       |
| `ariaLabel`             | 表格的无障碍名称                                             | `string`                                 | —       |
| `messages`              | 覆盖表格的文案，只需写要改的部分                             | `SheetMessagesOverride`                  | —       |

### Sheet Events

| 名称                | 说明                                                                    | 参数                           |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| `transaction`       | 每次修改后触发，包括撤销和重做，见[用代码修改](./transactions#修改事件) | `(tr: SheetTransaction)`       |
| `transactionCancel` | 修改被保护或扩展取消时触发                                              | `(tr: SheetTransaction)`       |
| `paste`             | 粘贴之前触发，见[复制与粘贴](./clipboard#粘贴事件)                      | `(event: SheetPasteEvent)`     |
| `linkOpen`          | 打开链接之前触发，见[链接](./notes#链接)                                | `(event: SheetLinkOpenEvent)`  |
| `import`            | 读完文件、写入之前触发，见[导入导出](./files#导入事件)                  | `(event: SheetImportEvent)`    |
| `fileError`         | 导入或导出失败时触发，见[导入导出](./files#出错时)                      | `(event: SheetFileErrorEvent)` |
| `commentAction`     | 在表格里对讨论做了一次修改，见[评论](./comments)                        | `(action: CommentAction)`      |

### Sheet Slots

| 名称     | 说明                                                                     |
| -------- | ------------------------------------------------------------------------ |
| `header` | 表格上方，放工具栏或编辑栏；里面的组件可以用 `useSheet()` 拿到表格的状态 |
| `footer` | 表格下方，放工作表标签                                                   |

### Sheet Exposes

| 名称                                                | 说明                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `transact(run, meta?)`                              | 在一个事务里修改，返回这次的事务，见[用代码修改](./transactions)                      |
| `undo()`、`redo()`                                  | 撤销、重做，返回是否执行                                                              |
| `canUndo`、`canRedo`                                | 能否撤销、重做                                                                        |
| `commands`                                          | 执行和查询命令，见[命令](./commands)                                                  |
| `select(target)`                                    | 选中一个区域并滚动到那里，如 `'A1:C4'`、`'B:B'`                                       |
| `scrollTo(cell)`                                    | 把单元格滚动到可见处                                                                  |
| `showSheet(sheet)`                                  | 按序号、`id` 或名字切换工作表，没有这个工作表时返回 `false`                           |
| `edit(cell?)`                                       | 打开单元格的编辑框，默认当前单元格                                                    |
| `editNote(cell?)`、`editLink(cell?)`                | 打开批注、链接的输入框，见[批注与链接](./notes)                                       |
| `focus()`                                           | 让表格获得焦点                                                                        |
| `copy()`、`cut()`、`paste(clip?)`                   | 复制、剪切、粘贴，见[复制与粘贴](./clipboard)                                         |
| `openSearch(query?)`、`closeSearch()`               | 打开、关闭查找面板，没有打开或关闭时返回 `false`，见[查找和替换](./filter#查找和替换) |
| `findCells(query)`                                  | 查找单元格，返回 `{ sheet, row, col }` 列表                                           |
| `findInvalid(sheet?)`                               | 不符合数据验证的单元格，见[数据验证](./rules#数据验证)                                |
| `toCSV(options?)`                                   | 当前（或 `sheet` 指定的）工作表转成 CSV 文本，见[CSV](./files#csv)                    |
| `exportSVG(options?)`、`exportPNG(options?)`        | 导出图片，见[导出图片与打印](./files#导出图片与打印)                                  |
| `print(options?)`                                   | 打印整张工作表                                                                        |
| `exportFile`、`saveFile`、`importFile`              | 导出、导出并下载、导入文件，见[导入导出](./files)                                     |
| `comment(cell?)`、`getCommentAnchors()`             | 打开讨论（打不开时返回 `false`）、读取讨论所在的单元格，见[评论](./comments)          |
| `restore(book)`、`nextChange()`、`previousChange()` | 恢复版本、在对比中跳到下一处或上一处改动，见[历史版本](./versions)                    |
