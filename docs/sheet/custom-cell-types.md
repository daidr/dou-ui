# 自定义单元格类型

扩展的 `cellTypes` 可以加自己的单元格类型，比如进度条、评分。内置的日期、下拉和勾选框见[单元格类型](./cell-types)。

## 基础用法

用 `defineSheetCellType` 定义类型，放进扩展的 `cellTypes`，单元格的 `type` 写类型的名字。下面的“评分”类型画成五颗星，输入 `4` 记为 4 星，输入 0 到 5 以外的数字时标为不符合。

<DocDemo src="sheet/cell-type" column />

```ts
import { defineSheetCellType, defineSheetExtension } from '@dou-ui/sheet'

const rating = defineSheetCellType({
  name: 'rating',
  parse: (text) => {
    const n = Number.parseInt(text, 10)
    return Number.isNaN(n) ? undefined : { value: n }
  },
  format: (value) => (typeof value === 'number' ? `${value} 星` : undefined),
  render: Stars,
})

const extensions = [defineSheetExtension({ name: 'rating', cellTypes: [rating] })]
```

- 和内置类型同名时替换内置的，多个扩展同名时用优先级高的。
- 类型的所有字段都可以不写，见下方 [API](#sheetcelltype)。

## 读和写

- `parse` 把输入的文字读成值。返回 `undefined` 时按普通单元格读：数字、日期、`TRUE` 之类照常识别，其余原样存成文字。
- `format` 是值显示成的文字，复制成纯文本和读屏软件也用它。
- `edit` 是编辑框打开时的文字，要能被 `parse` 读回同样的值。
- `plain` 是写进文件、给其他表格软件打开时用的值，比如评分写成数字。

因为读不懂的输入也会写入，`format`、`render` 要能处理不是这个类型的值。例如进度单元格里输入了文字，就只显示文字，再用 `valid` 把它标出来。

## 检查值

`valid` 返回 `true` 表示值符合类型，返回 `false` 或一句原因表示不符合。不符合的单元格左上角有红色小三角，原因在悬停时显示，读屏也会读出。空单元格总是符合。

`valid` 的第三个参数是当前语言的文案，内置类型用它给出“不是日期”“不在选项里”这样的原因；只返回 `false` 时显示通用的“不符合单元格类型”。

## 显示组件

`render` 是代替文字画在单元格里的组件，收到 `value`、`text`（`format` 之后的文字）、`setup` 和 `readonly`。

- 每个看得见的单元格都会画一个，要尽量轻。
- 读屏软件读的是 `text`，`render` 里的内容不会被读出，可以加 `aria-hidden`。
- 里面带 `data-sheet-toggle` 的元素被点击时切换值，需要类型有 `toggle`。
- 只显示文字时（比如值不是这个类型），用 `<span class="dou-sheet__text">` 包住 `text`，文字的对齐、换行和省略号就和普通单元格一样。

`toggle` 让空格、`F2`、双击和点 `data-sheet-toggle` 元素直接切换值，不打开编辑框。空格切换选区里所有同类单元格：值相同时一起切换，不同时都变成空单元格切换后的值。有 `toggle` 的类型读屏读“已勾选”或“未勾选”。

## 编辑面板

`panel` 是编辑时显示在单元格下方的面板，比如日历。面板收到 `value`（开始编辑时的值）、`text`（编辑框里现在的文字）、`typed`（开始编辑后是否输入过）和 `setup`，发出 `pick` 事件写入值并结束编辑。

编辑框始终保有焦点。面板想处理按键时，暴露一个 `onKey(event)`，处理了返回 `true`：

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

## 在图片里画出

导出图片和打印时放不了组件，默认画 `format` 的文字。`draw` 返回一段 SVG，代替文字画在单元格里：

```ts
const rating = defineSheetCellType({
  name: 'rating',
  render: RatingStars,
  // 图片里画成一排圆点，后面写上分数
  draw: (value, setup, draw) => {
    const count = Number(value) || 0
    const fill = draw.color('var(--dou-color-warning)')
    const dots = Array.from(
      { length: count },
      (_, i) => `<circle cx="${12 + i * 12}" cy="${draw.height / 2}" r="4" fill="${fill}"/>`,
    ).join('')
    return (
      dots + draw.text(`${count} 分`, { x: 12 + count * 12, y: 0, width: 60, height: draw.height })
    )
  },
})
```

- 坐标以单元格左上角为 `(0, 0)`，超出单元格的部分会被裁掉。
- 空单元格和公式出错的单元格不调用 `draw`，照常画文字。
- 第三个参数和[流程图节点的 `draw`](../flow/export#自定义节点) 同名同义，见下方 [SheetDrawContext](#sheetdrawcontext)。

## API

### SheetCellType

`setup` 是这个单元格的类型设置：工作簿 `types` 里对应的那一项，例如 `{ type: 'select', options: [...] }`；直接写类型名时是 `{ type: 'progress' }`。

| 名称     | 说明                                                              | 类型                                               |
| -------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `name`   | 类型的名字                                                        | `string`                                           |
| `parse`  | 把输入的文字读成 `{ value, format? }`；`undefined` 按普通单元格读 | `(text, setup) => SheetInput \| undefined`         |
| `format` | 值显示成的文字；默认按单元格的 `format` 显示                      | `(value, setup) => string \| undefined`            |
| `edit`   | 编辑框打开时的文字；默认用 `format` 的结果                        | `(value, setup) => string \| undefined`            |
| `valid`  | 值是否符合这个类型：`true`，或 `false`、一句原因                  | `(value, setup, messages) => boolean \| string`    |
| `render` | 代替文字画在单元格里的组件                                        | `Component`                                        |
| `panel`  | 编辑时显示在单元格下方的面板                                      | `Component`                                        |
| `toggle` | 切换后的值；有它时不打开编辑框                                    | `(value, setup) => SheetValue`                     |
| `align`  | 单元格样式没有指定对齐时的对齐方式                                | `'left' \| 'center' \| 'right'`                    |
| `plain`  | 写进文件时用的值；默认是值本身                                    | `(value, setup) => SheetValue`                     |
| `draw`   | 导出图片和打印时画在单元格里的 SVG                                | `(value, setup, draw: SheetDrawContext) => string` |

### SheetDrawContext

| 名称                          | 说明                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `width`、`height`             | 单元格的大小                                                                                                            |
| `formatted`                   | 单元格显示的文字，即 `format` 的结果                                                                                    |
| `look`                        | 单元格的样子：`color`、`background`（没有时为 `null`）、`align`、`valign`、`bold`、`italic`、`fontFamily`、`fontSize`   |
| `text(value, box?, options?)` | 在一个区域（默认整个单元格）里写一行字，已经转义；`options` 可以改 `align`、`valign`、`color`、`bold`、`italic`、`size` |
| `icon(icon, box, color)`      | 把图标组件（如 `@dou-ui/icons` 里的）画成 SVG                                                                           |
| `color(value)`                | 把 CSS 颜色（包括 `var(--dou-color-primary)` 这样的主题变量）换成 SVG 认得的颜色                                        |
| `escape(text)`                | 转义文字。自己拼 `<text>` 时，文字一定要经过它，否则 `&`、`<` 会让图片无法打开                                          |
