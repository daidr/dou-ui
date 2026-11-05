# 扩展

扩展可以给编辑器加上装饰、行号旁的标记、面板、小部件和检查。用 `defineCodeExtension` 定义扩展，通过 `extensions` 传给编辑器。

## 定义扩展

下面的示例包含三个扩展：标出 `TODO`、找出 `var` 并提供修复、点击行号左侧设置断点。

<DocDemo src="code/extension" column />

```ts
import { defineCodeExtension, type CodeDecoration } from '@dou-ui/code'

const todo = defineCodeExtension({
  name: 'todo',
  decorations(editor) {
    const out: CodeDecoration[] = []
    for (let n = editor.visible.from; n <= editor.visible.to; n++) {
      const line = editor.doc.line(n)
      const at = line.text.indexOf('TODO')
      if (at >= 0)
        out.push({ type: 'mark', from: line.from + at, to: line.from + at + 4, class: 'todo' })
    }
    return out
  },
})
```

扩展中的函数都会收到编辑器的上下文。上下文包含编辑器实例的全部属性和方法，另外还有 `visible`、`announce` 等，见下方 [API](#codeextensioncontext)。在面板或行号栏中渲染的组件可以用 `useCodeEditor()` 获取同一个上下文。

## 装饰

`decorations` 返回要装饰的文字，在绘制时调用，只需要给出可见的行：

- `{ type: 'mark', from, to, class, style?, title? }` 给一段文字加 class。`style` 适合放每个人不同的颜色这类值，如 `{ '--my-color': '#3b6ea8' }`。
- `{ type: 'line', line, class }` 给整行加 class，`line` 从 1 开始。
- `{ type: 'inline', pos, render, width?, id? }` 在 `pos` 处的字符之前放一个小部件，见[行内小部件](#行内小部件)。

`mark` 和 `line` 只能改变颜色、底色、下划线、边框等，不能改变字号和字重，否则光标位置会不准。

`decorations` 中读到的响应式数据变化时，装饰会自动更新。

## 行号栏

`gutters` 在行号左侧加一列，例如断点、修改标记：

```ts
defineCodeExtension({
  name: 'breakpoint',
  gutters: [
    {
      name: 'breakpoint',
      markers: () => [...breakpoints.value].map((line) => ({ line, title: '移除断点' })),
      onPress: (line) => toggle(line),
    },
  ],
})
```

有 `onPress` 的列里，每个标记都是一个按钮，`title` 是它的名称，必须填写（缺少时开发环境会给出警告）。光标所在行的标记可以用键盘操作：按 `Esc` 离开编辑区，再按 `Shift` + `Tab` 聚焦到它，按 `Enter` 或 `Space` 触发 `onPress`，第二个参数是这次的 `KeyboardEvent`。从页面上按 `Tab` 进入编辑器时，也会先停在这个标记上，再进入编辑区。按下后标记消失时（例如移除断点），焦点回到编辑区。其他行的标记不进入 Tab 顺序，免得一屏几十个标记挡在编辑区前面。没有标记的格子只能用鼠标或手指点。

需要在每一行提供一个操作时（比如“在这一行加断点”“在这一行写批注”），可以给列设置 `hoverMarker`：没有自己标记的行都会显示它，平时隐藏，在鼠标指着这一行（行号栏或文字都可以）、编辑器有焦点时光标所在的行、以及它自己获得焦点时显示；编辑器禁用时不显示。上面的示例里，指着某一行就会出现空心的断点。只想在部分行上提供时，给那些行返回 `visible: 'hover'` 的标记，效果相同。

触屏和触控笔上，点按在手指抬起、且没有移动时才触发 `onPress`，从行号栏开始拖动只会滚动。手指没法悬停，所以点一个还看不见的悬停标记时，第一下只把光标移到这一行，标记随之出现，再点一下才触发。

## 小部件

小部件是画在文字中的组件，分为画在一行之内的行内小部件和插在两行之间的行间小部件。

### 行内小部件

行内小部件画在一行文字中间，例如颜色值前的色块、参数名提示。它不是文字：光标会跳过它，复制时也不包含它。

给出 `width`（px）时按这个宽度排版；不给时绘制后测量宽度，并按 `id` 记住。位置会变化的小部件最好给出 `id`。

### 行间小部件

`widgets` 返回插在两行之间的组件，例如审阅评论。小部件横跨整个编辑区，下方的行会让出位置。

<DocDemo src="code/widgets" column />

- 用 `pos`（文本位置）或 `line`（行号）指定位置，默认画在这一行下方，`position: 'above'` 时画在上方。
- `widgets` 要返回全部文本中的小部件，因为它们的高度会影响后面每一行的位置，所以数量不宜过多。
- 小部件中可以放输入框和按钮。只用键盘时，按 `Esc` 再按 `Tab` 可以进入小部件。
- `label` 是小部件的名称，光标移到所在行时读屏会读出。

小部件的位置由扩展自己保存。上面的示例把评论的位置存为文本位置，在 `transaction` 事件中用 `changes.mapPos` 跟随修改移动。

## 面板

`panels` 返回显示在编辑区上方或下方的栏，位于编辑器边框之内：

```ts
defineCodeExtension({
  name: 'status',
  panels: (editor) => [
    { name: 'status', position: 'bottom', render: () => h('div', `共 ${editor.doc.lines} 行`) },
  ],
})
```

## 隐藏行

`hide` 返回不显示的行，例如对比时收起的行。上下移动光标时会跳过它们，原处不留标记；需要提示时，自己在那里放一个行间小部件。

## 响应修改

扩展可以在每次修改前后执行自己的逻辑：

- `transaction` 在每次修改应用之前调用，可以在同一次修改中追加改动。撤销、重做、外部传入的新值和其他人的修改不经过这里。
- `update` 在每次修改应用之后调用，包括撤销、重做、外部传入的新值和其他人的修改，用 `meta.action` 区分。

## API

### CodeExtension

| 名称                                                     | 说明                                                 | 类型                                       |
| -------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| `name`                                                   | 扩展的名称，用于区分各个扩展找到的问题               | `string`                                   |
| `priority`                                               | 优先级，大的先执行，它的快捷键也先尝试；默认 `100`   | `number`                                   |
| `keymap`                                                 | 快捷键，优先于内置快捷键，在 `keymap` 属性之后       | `(context) => CodeKeymap`                  |
| `decorations`                                            | 装饰                                                 | `(context) => CodeDecoration[]`            |
| `gutters`                                                | 行号左侧的列                                         | `CodeGutter[]`                             |
| `widgets`                                                | 行间小部件                                           | `(context) => CodeWidget[]`                |
| `hide`                                                   | 不显示的行，两端都包含                               | `(context) => { from, to }[]`              |
| `panels`                                                 | 上方或下方的栏                                       | `(context) => CodePanel[]`                 |
| `lint`                                                   | 检查文本，见[诊断](./assist#诊断)                    | `(context) => CodeDiagnostic[] \| Promise` |
| `completion`、`completionTriggers`、`hover`、`signature` | 补全和提示，见[补全与提示](./assist#补全)            | —                                          |
| `transaction`                                            | 修改应用之前调用                                     | `(tr, context) => void`                    |
| `update`                                                 | 修改应用之后调用                                     | `(result, context) => void`                |
| `history`                                                | 替换内置的撤销记录，例如协同编辑；有多个时使用第一个 | `(context) => CodeHistoryHandler`          |
| `menu`                                                   | 触屏选区工具条中追加的按钮                           | `(context) => { label, run }[]`            |
| `setup`                                                  | 挂载后调用一次，返回的函数在卸载时调用               | `(context) => void \| (() => void)`        |

### CodeExtensionContext

编辑器实例的全部属性和方法，以及：

| 名称             | 说明                                                      |
| ---------------- | --------------------------------------------------------- |
| `visible`        | 可见的行 `{ from, to }`，是行号而不是文本位置，两端都包含 |
| `diagnostics`    | 当前的所有问题                                            |
| `focused`        | 编辑器是否有焦点                                          |
| `messages`       | 编辑器使用的文字                                          |
| `announce(text)` | 让读屏读出一句话                                          |
| `relint(name?)`  | 立即重新运行某个扩展的 `lint`，不传时运行全部             |

### CodeGutter

| 名称          | 说明                                                                                                                                                                                                                                  | 类型                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `name`        | 列的名称                                                                                                                                                                                                                              | `string`                                                        |
| `width`       | 宽度（px），默认 `16`                                                                                                                                                                                                                 | `number`                                                        |
| `markers`     | 可见行上的标记 `{ line, icon?, text?, class?, title?, visible? }`；有 `onPress` 时 `title` 必填；`visible: 'hover'` 时只在指着这一行、光标在这一行或它有焦点时显示                                                                    | `(context) => CodeGutterMarker[]`                               |
| `pressOn`     | `onPress` 在哪里响应：默认 `any`，这一列的任何格子都能点（比如在空行上加断点）；`markers` 时只有标记能点，空格子不显示手形光标                                                                                                        | `'any' \| 'markers'`                                            |
| `hoverMarker` | 没有自己标记的每一行都显示的标记 `{ icon?, text?, class?, title? }`，悬停时出现；有 `onPress` 时 `title` 必填。`title` 可以是 `(line) => string`，给每一行一个名称，比如“在第 3 行加断点”；它会对可见的每一行频繁调用，不要做耗时操作 | `CodeGutterHoverMarker`                                         |
| `onPress`     | 点击某一行的这一列，或在标记上按 `Enter`、`Space`                                                                                                                                                                                     | `(line, event: PointerEvent \| KeyboardEvent, context) => void` |

### CodeWidget

| 名称       | 说明                                   | 类型                 |
| ---------- | -------------------------------------- | -------------------- |
| `id`       | 在同一个扩展中唯一                     | `string`             |
| `pos`      | 所在的文本位置，和 `line` 二选一       | `number`             |
| `line`     | 所在的行号，从 1 开始                  | `number`             |
| `position` | 画在这一行的上方或下方，默认 `'below'` | `'above' \| 'below'` |
| `render`   | 渲染函数                               | `() => VNodeChild`   |
| `height`   | 绘制前估计的高度（px），默认一行       | `number`             |
| `label`    | 读屏读出的名称                         | `string`             |

### CodePanel

| 名称       | 说明                  | 类型                |
| ---------- | --------------------- | ------------------- |
| `name`     | 在同一个扩展中唯一    | `string`            |
| `position` | 位置，默认 `'bottom'` | `'top' \| 'bottom'` |
| `render`   | 渲染函数              | `() => VNodeChild`  |
