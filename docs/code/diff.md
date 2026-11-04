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
| `toolbar`           | 显示工具栏                                                                                     | `boolean`                                            | `true`   |
| `bordered`          | 整体的外框和圆角；关闭后去掉外框和圆角，聚焦时也不再画出边框，工具栏和左右两栏之间的分隔线保留 | `boolean`                                            | `true`   |
| `tabSize`           | 制表位宽度                                                                                     | `number`                                             | `2`      |
| `messages`          | 改写界面上的文字                                                                               | `Partial<CodeMessages>`                              | —        |

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
