# 扩展

扩展把单元格类型、快捷键、右键菜单项、浮在表格上的组件和修改钩子打包在一起，用 `extensions` 传给表格，适合把一组相关的定制放在一处，在多个表格之间复用。

下面的例子用了两个扩展：一个加了“进度”单元格类型，画成进度条，输入 `60` 或 `60%` 都记为 0.6，右键菜单里多一项“标为完成”，作用于选中的所有进度单元格；另一个用 `Ctrl` / `⌘` + `;` 或右键菜单（手机上长按）在当前单元格填入今天的日期。

<DocDemo src="sheet/extension" column />

## 定义扩展

```ts
import { defineSheetCellType, defineSheetExtension } from '@dou-ui/sheet'

const progress = defineSheetExtension({
  name: 'progress',
  cellTypes: [
    defineSheetCellType({
      name: 'progress',
      parse: (text) => ({ value: Number.parseFloat(text) / 100 }),
      format: (value) => `${Math.round(Number(value) * 100)}%`,
      render: ProgressBar,
    }),
  ],
})

const extensions = [progress]
```

```vue-html
<DouSheet v-model="book" :extensions="extensions" />
```

`defineSheetExtension` 和 `defineSheetCellType` 只用来提供类型，返回传入的对象本身。扩展的名字不能重复，重复时会抛出错误。扩展列表在 `<script setup>` 里创建一次即可；模板里每次渲染写出的新数组，只要里面的扩展相同，就不会重新初始化。

编辑、选择、剪贴板、填充、合并和内置的单元格类型都是组件自带的，不是扩展。`extensions` 只在这些功能之上追加。

## 扩展的字段

| 名称          | 说明                                                                                                         | 类型                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `name`        | 扩展的名字                                                                                                   | `string`                                              |
| `priority`    | 优先级，越大越先处理按键和钩子，默认 `100`                                                                   | `number`                                              |
| `cellTypes`   | 单元格类型，见下文；和内置类型同名时替换内置的，多个扩展同名时用优先级高的                                   | `SheetCellType[]`                                     |
| `functions`   | 公式里可以调用的函数，见[自定义函数](./formulas#自定义函数)；和内置函数同名时替换内置的                      | `SheetFunction[]`                                     |
| `keymap`      | 表格有焦点、没有在编辑单元格时的快捷键，写法和 `useHotkey` 一样；处理函数返回 `false` 表示没处理，交给下一个 | `(ctx) => Record<string, (event) => boolean \| void>` |
| `contextMenu` | 右键菜单的项，排在内置项前面；`menu` 属性收到的菜单项里也包括它们                                            | `(ctx, menu: SheetMenuContext) => SheetMenuItem[]`    |
| `overlays`    | 浮在表格上方的组件，不随表格滚动，可以用 `cellRect` 对准单元格                                               | `Component[]`                                         |
| `setup`       | 表格挂载后调用，可以返回一个函数，在卸载时调用                                                               | `(ctx) => void \| (() => void)`                       |
| `transaction` | 表格里的每次修改和 `transact` 生效前按优先级调用，可以继续往里加步骤；撤销时加上的步骤一起撤销               | `(tr, ctx) => void`                                   |

`ctx` 和组件里 `useSheet()` 拿到的是同一个对象。

## 单元格类型

单元格的 `type` 写类型的名字，或工作簿 `types` 里的名字（见[单元格类型](./#单元格类型)）。一个类型可以提供下面这些字段，都可以不写：

| 名称     | 说明                                                                                                                                                        | 类型                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `name`   | 类型的名字                                                                                                                                                  | `string`                                        |
| `parse`  | 把输入的文字读成值，返回 `{ value, format? }`；返回 `undefined` 时按普通单元格读                                                                            | `(text, setup) => SheetInput \| undefined`      |
| `format` | 值显示成的文字；默认按单元格的 `format` 显示。复制成纯文本和读屏软件也用这段文字                                                                            | `(value, setup) => string \| undefined`         |
| `edit`   | 编辑框打开时的文字，要能被 `parse` 读回同样的值；默认用 `format` 的结果，没有 `format` 时用值本身                                                           | `(value, setup) => string \| undefined`         |
| `valid`  | 值是否符合这个类型：返回 `true`，或者返回 `false`、一句原因。不符合的单元格右上角有红色小三角，原因在悬停时显示，读屏也会读出。空单元格总是符合             | `(value, setup, messages) => boolean \| string` |
| `render` | 代替文字画在单元格里的组件。每个看得见的单元格都会画一个，要尽量轻；里面带 `data-sheet-toggle` 的元素被点击时切换值                                         | `Component`                                     |
| `panel`  | 编辑时显示在单元格下方的面板，比如日历；发出 `pick` 事件写入值并结束编辑                                                                                    | `Component`                                     |
| `toggle` | 有它时，空格、`F2`、双击和点 `data-sheet-toggle` 元素会切换值，不打开编辑框。空格切换选区里所有同类单元格：值相同时一起切换，不同时都变成空单元格切换后的值 | `(value, setup) => SheetValue`                  |
| `align`  | 单元格样式没有指定对齐时的对齐方式                                                                                                                          | `'left' \| 'center' \| 'right'`                 |

`setup` 是这个单元格的类型设置：工作簿 `types` 里对应的那一项，例如 `{ type: 'select', options: [...] }`；直接写类型名时是 `{ type: 'progress' }`。

`parse` 返回 `undefined` 时，文字按普通单元格读：数字、日期、`TRUE` 之类照常识别，其余原样存成文字。所以 `format`、`render` 要能处理不是这个类型的值，例如进度单元格里输入了文字，就只显示文字，`valid` 再把它标出来。`valid` 的第三个参数是当前语言的文案，内置类型用它给出“不是日期”“不在选项里”这样的原因；只返回 `false` 时显示通用的“不符合单元格类型”。

`render` 组件收到 `value`、`text`（`format` 之后的文字）、`setup` 和 `readonly`。读屏软件读的是 `text`，有 `toggle` 的类型读“已勾选”或“未勾选”，`render` 里的内容不会被读出，可以加 `aria-hidden`。

`panel` 组件收到 `value`（开始编辑时的值）、`text`（编辑框里现在的文字）、`typed`（开始编辑后是否输入过）和 `setup`。编辑框始终保有焦点，面板想处理按键时，暴露一个 `onKey(event)`，处理了返回 `true`：

```ts
const Panel = defineComponent({
  props: ['value', 'text', 'typed', 'setup'],
  emits: ['pick'],
  setup(props, { emit, expose }) {
    expose({
      onKey: (event: KeyboardEvent) => {
        if (event.key !== 'Enter') return false
        emit('pick', props.text.toUpperCase())
        return true
      },
    })
    return () => h('div', { class: 'my-panel' }, props.text)
  },
})
```

## 快捷键

扩展的快捷键先于表格自己的按键处理，多个扩展按 `priority` 从高到低依次询问。处理函数没有返回 `false` 时，按键就算处理过了，表格会阻止它的默认行为。正在编辑单元格时不会触发。

## useSheet

在扩展的钩子、浮层组件、单元格类型的组件和表格的 `header`、`footer` 插槽里，`useSheet()` 返回当前表格的状态和操作：

| 名称                                             | 说明                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `doc`、`sheet`、`sheetIndex`                     | 工作簿、当前显示的工作表和它的序号                                                            |
| `selection`、`active`                            | 选区和键盘所在的单元格                                                                        |
| `readonly`、`messages`                           | 只读状态、当前语言的文案                                                                      |
| `value(point)`、`result(point)`                  | 当前工作表里一个单元格的值（公式单元格是公式本身），和它的计算结果                            |
| `forEachSelected(callback)`                      | 依次处理选中的每个单元格，合并单元格只算一次（左上角）                                        |
| `cellType(point)`                                | 单元格的类型 `{ name, definition, setup }`，`definition` 是类型本身；普通单元格为 `undefined` |
| `cellRect(point)`                                | 单元格（或它所在的合并单元格）现在画在哪，看不见时为 `null`                                   |
| `transact`、`undo`、`redo`、`canUndo`、`canRedo` | 修改与撤销，同组件实例                                                                        |
| `select`、`scrollTo`、`edit`、`focus`            | 选择、滚动、编辑和聚焦，同组件实例                                                            |
| `showSheet`、`toCSV`                             | 切换工作表、导出 CSV，同组件实例                                                              |
| `styleAt(point)`、`formatAt(point)`              | 单元格的样式（没有时为 `{}`）和数字格式，合并单元格取左上角                                   |
| `styleSelection(patch)`                          | 修改选区的样式，规则同 `tr.styleCells`，`null` 去掉样式；返回是否有改动                       |
| `formatSelection(format)`                        | 设置选区的数字格式，也可以传函数逐格计算，同 `tr.formatCells`                                 |
| `clearFormatting()`                              | 去掉选区的样式和数字格式                                                                      |
| `merged`、`canMerge`、`merge()`、`unmerge()`     | 选区是否碰到合并单元格、能否合并；合并（会提示清空了几格）、取消合并                          |
| `announce(text)`                                 | 让读屏软件播报一段文字                                                                        |
| `editor`                                         | 正在编辑的单元格，供表格外的输入框使用，见下文                                                |

`editor` 让表格外的输入框和单元格一起编辑，`DouSheetFormulaBar` 就是用它做的：

| 名称                        | 说明                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `cell`、`text`、`caret`     | 正在编辑的单元格（没有时为 `null`）、编辑中的文字和光标位置                              |
| `textAt(point)`             | 单元格编辑时显示的文字：公式，或按输入方式写出的值                                       |
| `input(text, caret?)`       | 改写编辑中的文字；还没在编辑时，开始编辑当前单元格                                       |
| `caretMoved(caret)`         | 输入框的光标被按键或点击移动后告诉表格                                                   |
| `key(event)`                | 按单元格编辑时的规则处理按键（补全、插入引用、`Enter`、`Tab`、`Esc`），处理了返回 `true` |
| `commit(move?)`、`cancel()` | 保存或放弃编辑，之后键盘回到表格                                                         |
| `attach(el)`                | 登记输入框：焦点移到它上面时编辑不结束，函数列表显示在它下方；返回取消登记的函数         |
| `helpId`                    | 函数列表和参数提示的 id，用于 `aria-controls`                                            |

`cellRect` 的坐标从表格左上角算起，包括列标和行号，已经减去滚动的距离，可以直接给浮层组件用 `position: absolute` 摆放。
