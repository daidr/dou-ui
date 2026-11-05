# 对比视图

`DouCodeDiff` 用于对比两段文本，标出删除和新增的行以及行内改动的词。

## 基础用法

`original` 是原文，`v-model` 是修改后的文本。

<DocDemo src="code/diff" column />

删除和新增的行用浅色底标出，行内改动的词用更深的底色标出。行号旁的 `−` / `+` 不依赖颜色也能区分。

## 显示方式

`mode` 设置显示方式：

- `split`：左右并排，两侧逐行对齐，一起滚动。
- `inline`：删除和新增的行放在同一列，左侧两列行号分别对应原文和修改后的文本。
- `auto`（默认）：宽度不少于 560px 时并排，更窄时（例如手机上）使用 `inline`。

工具栏上的按钮可以切换显示方式，用 `v-model:mode` 可以保存切换结果。并排时不会自动换行，`wrap` 只对 `inline` 生效。

## 收起未改动的行

连续多行没有改动时，只保留改动前后各 3 行，其余的收起为“N 行未改动”，点击即可展开。

`collapseUnchanged` 设为 `false` 时显示全部行，也可以传入 `{ context, minLines }`：`context` 是改动前后保留的行数，`minLines` 是至少能收起多少行时才收起（默认 4）。

## 编辑

加上 `editable` 后，可以在并排视图的右侧修改文本，对比结果随输入更新。`inline` 视图始终只读。

`F7` / `Shift` + `F7` 跳到下一处 / 上一处改动。

## 批注

`gutters` 在行号左侧加列，`widgets` 在行与行之间放组件，适合做审阅评论、断点这类需要标在某一侧某一行上的东西。每个标记和小部件都用 `side`（`'original'` 或 `'modified'`）和 `line` 指明位置，行号是那一侧文本自己的行号。两种显示方式下，组件都会把它们放到对应的行上：

- 并排时，标记画在它那一侧；小部件画在它那一侧，另一侧在对齐的位置留出同样高的空白，两侧不会错位。`span: 'both'` 的小部件横跨两栏，适合写给整段改动的说明。
- `inline` 时，标记和小部件都放在这一行所在的位置；两侧共有的行上，修改后一侧的标记优先显示。

点击 `gutters` 的列时触发 `onPress(line, side, event)`，`side` 是被点的那一侧。在 `inline` 视图中，两侧共有的行算作那里标记所在的一侧，没有标记时算作 `modified`。

<DocDemo src="code/diff-review" column />

`extensions` 只作用于并排时修改后的一侧，用于语言服务、检查这类读取文本的扩展；标在两侧行上的东西用 `gutters` 和 `widgets`。

## 只计算差异

`diffText(original, modified, options?)` 返回改动列表，不需要渲染组件：

```ts
import { diffText } from '@dou-ui/code'

const hunks = diffText('上海\n戴兜\n', '上海\n阿青\n')
// [{ originalStart: 2, originalCount: 1, modifiedStart: 2, modifiedCount: 1, parts: [] }]
```

行号从 1 开始，`parts` 是改动的词在两段文本中的位置。对比按整行进行，行内再按词比较，中文按字比较。

## API

### CodeDiff Props

| 名称                | 说明                                                                                           | 类型                                                 | 默认值   |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| `original`          | 原文                                                                                           | `string`                                             | `''`     |
| `v-model`           | 修改后的文本                                                                                   | `string`                                             | `''`     |
| `v-model:mode`      | 显示方式                                                                                       | `'split' \| 'inline' \| 'auto'`                      | `'auto'` |
| `language`          | 语言                                                                                           | `CodeLanguage \| null`                               | —        |
| `editable`          | 允许在并排视图的右侧修改                                                                       | `boolean`                                            | `false`  |
| `collapseUnchanged` | 收起未改动的行                                                                                 | `boolean \| { context?: number, minLines?: number }` | `true`   |
| `ignoreWhitespace`  | 只有空白不同的行视为相同                                                                       | `boolean`                                            | `false`  |
| `words`             | 标出行内改动的词                                                                               | `boolean`                                            | `true`   |
| `wrap`              | `inline` 视图中自动换行                                                                        | `boolean`                                            | `false`  |
| `extensions`        | 右侧编辑器的扩展，只在并排时使用                                                               | `CodeExtension[]`                                    | —        |
| `gutters`           | 行号左侧的列，标记可以在任一侧，见[批注](#批注)                                                | `CodeDiffGutter[]`                                   | —        |
| `widgets`           | 行间的组件，可以在任一侧或横跨两栏，见[批注](#批注)                                            | `CodeDiffWidget[]`                                   | —        |
| `toolbar`           | 显示工具栏                                                                                     | `boolean`                                            | `true`   |
| `bordered`          | 整体的外框和圆角；关闭后去掉外框和圆角，聚焦时也不再画出边框，工具栏和左右两栏之间的分隔线保留 | `boolean`                                            | `true`   |
| `tabSize`           | 制表位宽度                                                                                     | `number`                                             | `2`      |
| `messages`          | 改写界面上的文字                                                                               | `Partial<CodeMessages>`                              | —        |

### CodeDiffGutter

| 名称      | 说明                                                                              | 类型                                                              |
| --------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `name`    | 列名，各列不能重复                                                                | `string`                                                          |
| `width`   | 宽度，单位 px，默认 16                                                            | `number`                                                          |
| `markers` | 标记 `{ side, line, icon?, text?, class?, title? }`，其余字段同编辑器的行号栏标记 | `CodeDiffGutterMarker[]`                                          |
| `onPress` | 点击这一列                                                                        | `(line: number, side: CodeDiffSide, event: PointerEvent) => void` |

### CodeDiffWidget

| 名称       | 说明                                               | 类型                       |
| ---------- | -------------------------------------------------- | -------------------------- |
| `id`       | 区分各个小部件，测得的高度按它保存                 | `string`                   |
| `side`     | 在哪一侧                                           | `'original' \| 'modified'` |
| `line`     | 在这一行下方，行号从 1 开始                        | `number`                   |
| `position` | `above` 时放在这一行上方，默认 `below`             | `'above' \| 'below'`       |
| `render`   | 渲染内容                                           | `() => VNodeChild`         |
| `height`   | 测量前的估计高度，单位 px，默认一行                | `number`                   |
| `label`    | 光标移到这一行时读出的名称，例如“戴兜的评论”       | `string`                   |
| `span`     | 并排时 `both` 横跨两栏，默认 `side` 只占自己那一栏 | `'side' \| 'both'`         |

### CodeDiff Exposes

| 名称                           | 说明                                             |
| ------------------------------ | ------------------------------------------------ |
| `hunks`                        | 当前的改动列表                                   |
| `next()`、`previous()`         | 跳到下一处、上一处改动                           |
| `expandAll()`、`collapseAll()` | 展开、收起全部未改动的行                         |
| `original`、`modified`         | 两侧的编辑器实例；`inline` 视图中只有 `modified` |

### CSS 变量

| 名称                     | 说明                                                | 默认值                    |
| ------------------------ | --------------------------------------------------- | ------------------------- |
| `--dou-code-diff-border` | 外框和内部分隔线的颜色；只想去掉外框时用 `bordered` | `var(--dou-color-border)` |
