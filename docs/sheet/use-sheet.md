# useSheet

在表格的 `header`、`footer` 插槽，扩展的钩子、浮层和图层，以及单元格类型的组件里，`useSheet()` 返回当前表格的状态和操作。

## 基础用法

下面的状态栏放在 `footer` 插槽里，显示当前单元格的地址和选区里数字的合计。

<DocDemo src="sheet/use-sheet" column />

```ts
import { useSheet } from '@dou-ui/sheet'

const { active, forEachSelected, result } = useSheet()
```

`useSheet()` 拿到的对象和扩展钩子收到的 `ctx` 是同一个。这里的 `transact`、`undo`、`redo` 代表使用者的操作，所以只读时不生效：`transact` 返回的事务 `tr.cancelled` 为 `true`（`history: false` 的除外），`undo`、`redo` 返回 `false`。

## 定位

`cellRect(point)` 和 `rangeRect(bounds)` 返回单元格、区域现在画在哪里。坐标从表格左上角算起，包括列标和行号，已经减去滚动的距离，可以直接给浮层组件用 `position: absolute` 摆放。

- 单元格看不见时 `cellRect` 返回 `null`；合并单元格返回整个合并区域。
- `rangeRect` 返回区域在视图里露出的部分，`cut` 标出被视图或冻结窗格挡住的边；完全看不见时为 `null`。

## 表格外的输入框

`editor` 让表格外的输入框和单元格一起编辑，`DouSheetFormulaBar` 就是用它做的。

- `attach(el, options?)` 登记输入框：焦点移到它上面时编辑不结束，函数列表显示在它下方。返回取消登记的函数。
- `options.managed: true` 表示输入框自己按 `text` 和 `caret` 显示文字和光标，表格不改写它的值，适合文字不在这个元素里的输入框，例如代码编辑器。`DouSheetCodeFormulaBar` 就是这样接入的。
- `options.anchor` 是函数列表摆放在其下方的元素，默认是输入框本身。

## API

### 状态

| 名称                         | 说明                               |
| ---------------------------- | ---------------------------------- |
| `doc`、`sheet`、`sheetIndex` | 工作簿、当前显示的工作表和它的序号 |
| `selection`、`active`        | 选区和键盘所在的单元格             |
| `readonly`、`messages`       | 只读状态、当前语言的文案           |
| `focused`                    | 表格或单元格编辑框是否有键盘焦点   |
| `merged`、`canMerge`         | 选区是否碰到合并单元格、能否合并   |
| `filtered`                   | 当前工作表是否有筛选               |

### 读取

| 名称                                   | 说明                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- |
| `value(point)`、`result(point)`        | 当前工作表里一个单元格的值（公式单元格是公式本身），和它的计算结果   |
| `forEachSelected(callback)`            | 依次处理选中的每个单元格，合并单元格只算一次（左上角）               |
| `cellType(point)`                      | 单元格的类型 `{ name, definition, setup }`，普通单元格为 `undefined` |
| `styleAt(point)`、`formatAt(point)`    | 单元格的样式（没有时为 `{}`）和数字格式，合并单元格取左上角          |
| `cellRect(point)`、`rangeRect(bounds)` | 单元格、区域现在画在哪里，见[定位](#定位)                            |

### 操作

| 名称                                               | 说明                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `transact`、`undo`、`redo`、`canUndo`、`canRedo`   | 修改与撤销，同组件实例，只读时不生效                                    |
| `select`、`scrollTo`、`edit`、`focus`、`showSheet` | 选择、滚动、编辑、聚焦和切换工作表，同组件实例                          |
| `styleSelection(patch)`                            | 修改选区的样式，规则同 `tr.styleCells`，`null` 去掉样式；返回是否有改动 |
| `formatSelection(format)`                          | 设置选区的数字格式，也可以传函数逐格计算                                |
| `clearFormatting()`                                | 去掉选区的样式和数字格式                                                |
| `merge()`、`unmerge()`                             | 合并（会提示清空了几格）、取消合并                                      |
| `sort(order)`                                      | 按当前列排序，规则同右键菜单；返回是否排序                              |
| `toggleFilter()`                                   | 加上或去掉筛选                                                          |
| `announce(text)`                                   | 让读屏软件播报一段文字                                                  |
| `commands`                                         | 执行和查询命令，见[命令](./commands)                                    |

### 文件

| 名称                                       | 说明                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `toCSV`、`exportSVG`、`exportPNG`、`print` | 导出 CSV 和图片、打印，同组件实例                                                                   |
| `exportFile`、`saveFile`、`importFile`     | 导出、导出并下载、导入文件，见[导入导出](./files)                                                   |
| `exporters`、`importers`、`importAccept`   | 所有导出器、导入器，以及文件选择框能用的 `accept`；`label` 已按当前语言给出，自己做导入导出按钮时用 |
| `toolbarItems`                             | 扩展加到工具栏上的按钮，按优先级排列；自己做工具栏时用                                              |

### editor

| 名称                        | 说明                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `cell`、`text`、`caret`     | 正在编辑的单元格（没有时为 `null`）、编辑中的文字和光标位置                              |
| `textAt(point)`             | 单元格编辑时显示的文字：公式，或按输入方式写出的值                                       |
| `input(text, caret?)`       | 改写编辑中的文字；还没在编辑时，开始编辑当前单元格                                       |
| `moveCaret(caret)`          | 输入框的光标被按键或点击移动后告诉表格                                                   |
| `key(event)`                | 按单元格编辑时的规则处理按键（补全、插入引用、`Enter`、`Tab`、`Esc`），处理了返回 `true` |
| `commit(move?)`、`cancel()` | 保存或放弃编辑，之后键盘回到表格                                                         |
| `attach(el, options?)`      | 登记输入框，返回取消登记的函数                                                           |
| `helpId`                    | 函数列表和参数提示的 id，用于 `aria-controls`                                            |
| `functions`                 | 公式可以调用的函数，包括内置的和扩展添加的                                               |
