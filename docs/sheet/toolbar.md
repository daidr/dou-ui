# 工具栏与工作表

`DouSheetToolbar` 是格式工具栏，`DouSheetTabs` 是工作表标签栏，分别放在表格的 `header` 和 `footer` 插槽里。

## 工具栏

把 `DouSheetToolbar` 放进 `header` 插槽，表格上方出现格式工具栏。按钮作用于选区，按下的状态跟着当前单元格。

<DocDemo src="sheet/toolbar" column />

工具栏包括：

- 撤销、重做。
- 数字格式：常规、数字、百分比、货币、日期、时间、文本，旁边是增减小数位的按钮。没有格式的数字按显示的位数开始加减。
- 加粗、斜体、下划线、删除线。
- 文字颜色和填充颜色：主题的五种语义色会跟着暗色模式变化；“自定义颜色”可以选任意颜色，原样使用。
- 水平对齐、垂直对齐和自动换行。没有设置对齐时，按下的是单元格本来的对齐方式，比如数字靠右。
- 合并单元格，冻结行列，插入链接。
- 排序和筛选，见[排序、筛选与查找](./filter)。
- 条件格式和数据验证，见[条件格式与数据验证](./rules)。
- 保护，见[保护](./protect)。
- 清除格式：去掉样式和数字格式，值不变。

用鼠标点按钮后，键盘仍在表格里，可以接着输入；用键盘在工具栏里操作时（`Tab` 进入，左右方向键移动），焦点留在工具栏。工具栏放不下时横向滚动。只读时按钮都不可用。

## 选择按钮

`tools` 指定显示哪些按钮和顺序，`'|'` 是分隔线。`start`、`end` 插槽可以在前后加自己的按钮：

```vue
<DouSheetToolbar :tools="['undo', 'redo', '|', 'bold', 'italic', '|', 'color', 'fill']">
  <template #end>
    <DouButton variant="ghost" @click="exportCSV">导出</DouButton>
  </template>
</DouSheetToolbar>
```

- 内置的按钮：`undo`、`redo`、`format`、`decimals`、`bold`、`italic`、`underline`、`strike`、`color`、`fill`、`align`、`valign`、`wrap`、`merge`、`freeze`、`link`、`sort`、`filter`、`conditional`、`validation`、`protect`、`clear`。
- 默认不显示的按钮：`export`、`import`，见[导入导出](./files)。
- 扩展加的按钮写它的 `key`，任何命令写命令名（比如 `'print'`、`'find'`），见[命令与工具栏按钮](./commands#工具栏按钮)。

`formats` 替换数字格式菜单里的选项，每项是 `{ label, format, example? }`，`example` 是菜单里用这个格式显示的示例值。

显示单元格地址和公式的编辑栏是 `DouSheetFormulaBar`，同样放在 `header` 插槽里，可以和工具栏一起用，见[公式 · 编辑栏](./formulas#编辑栏)。

## 自己做工具栏

工具栏的按钮都通过[命令](./commands)执行。自己做工具栏时，可以用 `commands.run('bold')` 这样调用，也可以用 `useSheet()` 提供的方法：`styleAt(cell)` 读取单元格的样式，`styleSelection(patch)` 修改选区的样式，`formatSelection(format)` 设置数字格式，以及 `clearFormatting()`、`merge()`、`unmerge()`，见 [useSheet](./use-sheet)。

## 用代码改样式

`tr.styleCells(range, patch)` 把 `patch` 叠加到区域里每个单元格原有的样式上。字段设为 `undefined`（或 `false`）去掉这一项，`patch` 为 `null` 时去掉整个样式。

```ts
sheet.value.transact((tr) => {
  tr.styleCells('A1:E1', { bold: true, fill: 'neutral' })
  tr.styleCells('C:D', { align: 'right' }) // 整列，到工作表的最后一行为止
  tr.formatCells('C2:D20', '¥#,##0.00')
  tr.formatCells('C2:D20', (format, value) => changeDecimals(format, value, 1)) // 多一位小数
})
```

改完后看起来一样的单元格共用一个命名样式：`styles` 里有一样的就用它，没有就新建一个，名字是 `s1`、`s2` 这样的编号。所以给一列样式各不相同的单元格加粗，每种原有样式各得到一个加粗的版本，不会每格存一份。

`changeDecimals(format, value, by)` 返回多 `by` 位（为负时少）小数的格式，比如 `0.00` 变成 `0.000`、`0.0%` 变成 `0%`；`format` 为空时从 `value` 显示的位数开始。日期、时间和文本格式原样返回。

## 多个工作表

工作簿的 `sheets` 里每一项是一个工作表，`v-model:activeSheet` 是显示的工作表的序号。把 `DouSheetTabs` 放进 `footer` 插槽，表格下方出现工作表标签。

<DocDemo src="sheet/sheets" column />

- 点标签切换工作表，`+` 在当前工作表后面新建一个，`:addable="false"` 去掉这个按钮。
- 双击标签或按 `F2` 重命名，名字不能为空，也不能和别的工作表重名。
- 右键（手机上点一下当前的标签）打开菜单，可以重命名、创建副本、左右移动和删除。
- 拖动标签调整顺序，手机上按住一会儿再拖。
- 标签获得焦点后，左右方向键切换工作表，`Home` / `End` 到第一个、最后一个，`Enter` 回到表格。表格里按 `Ctrl` + `Page Up` / `Page Down` 也能切换。

这些操作都可以撤销，只读时只能切换。每个工作表各自记住选区和滚动位置，切回来时恢复。标签栏也可以用 `useSheet()` 照着 `DouSheetTabs` 自己做。

## 用代码管理工作表

```ts
sheet.value.transact((tr) => {
  tr.addSheet({ name: '十一月' }) // 加在最后，也可以传第二个参数指定位置
  tr.addSheet({ name: tr.uniqueName('九月') }) // 名字被占用时自动编号，得到“九月 (2)”
  tr.renameSheet('九月', '九月 上海')
  tr.duplicateSheet('十月') // 名为“十月 (2)”，放在原工作表后面
  tr.moveSheet('十一月', 0)
  tr.removeSheet('汇总')
})
sheet.value.showSheet('十一月')
```

- 名字不能和已有的工作表重复，否则抛出错误。`tr.uniqueName(name)` 返回一个没被占用的名字。
- `addSheet()` 不传名字时用 `Sheet1`、`Sheet2` 这样的名字，不随语言变化；标签栏的 `+` 按当前语言起名，比如“工作表3”。
- 重命名后，公式里指向它的引用改成新名字，比如 `=九月!B2` 变成 `='九月 上海'!B2`；删除后，指向它的引用变成 `#REF!`。
- 工作簿至少保留一个工作表，删除最后一个时不做任何事。
- 增删和移动工作表后，表格继续显示原来那一张；它被删除时，显示原来位置上的那一张。

## API

### SheetToolbar Props

| 名称       | 说明                                                                               | 类型                                    | 默认值                       |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------- |
| `tools`    | 显示哪些工具、按什么顺序：内置工具、扩展按钮的 `key` 或任何命令名，`'\|'` 是分隔线 | `(SheetToolbarTool \| string)[]`        | 全部内置工具，再加扩展的按钮 |
| `formats`  | 数字格式菜单里的选项，替换默认的那些                                               | `SheetFormatOption[]`                   | —                            |
| `fileName` | 导出菜单保存的文件名，见[导入导出](./files#导出菜单)                               | `string \| (exporter, scope) => string` | 导出的工作表名               |

### SheetToolbar Slots

| 名称    | 说明                 |
| ------- | -------------------- |
| `start` | 工具前面放的其他控件 |
| `end`   | 工具后面放的其他控件 |

### SheetTabs Props

| 名称      | 说明                 | 类型      | 默认值 |
| --------- | -------------------- | --------- | ------ |
| `addable` | 显示新建工作表的按钮 | `boolean` | `true` |

### 事务方法

| 方法                                                     | 说明                                                      |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `styleCells(range, patch)`、`formatCells(range, format)` | 修改区域的样式、数字格式；`format` 也可以是逐格计算的函数 |
| `setStyle(name, style)`                                  | 添加、修改或（传 `undefined`）删除一个命名样式            |
| `addSheet(sheet?, index?)`、`removeSheet(sheet)`         | 新建、删除工作表                                          |
| `renameSheet(sheet, name)`、`moveSheet(sheet, index)`    | 重命名、移动工作表                                        |
| `duplicateSheet(sheet, name?)`                           | 复制工作表                                                |
| `uniqueName(name)`                                       | 返回一个没被占用的工作表名字                              |
| `updateSheet(patch, sheet?)`                             | 修改工作表的名字、冻结、行列数                            |
