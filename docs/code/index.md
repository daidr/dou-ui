# 代码编辑器

`@dou-ui/code` 提供代码编辑器 `DouCodeEditor`，用于编辑配置、脚本、练习题这类代码。只展示代码时，使用 [CodeBlock 代码块](/components/code-block)。

## 安装

代码编辑器是单独的包，需要和 `dou-ui` 一起安装：

```sh
bun add dou-ui @dou-ui/code
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/code/style.css'
import { DouCodeEditor } from '@dou-ui/code'

app.use(DouCodeEditor)
```

## 基础用法

使用 `v-model` 绑定代码字符串，`language` 设置语言。

<DocDemo src="code/basic" column />

编辑器的高度随内容增长。内容较多时，用 CSS 给编辑器设置 `height` 或 `max-height`，超出的部分在编辑器内滚动。

字符串里的 `\r\n` 和 `\r` 都按换行读入，`v-model` 交回的字符串统一使用 `\n`。

## 编辑辅助

设置 `language` 后，编辑器会：

- 按 `Enter` 时保留缩进，在左括号或 HTML 开始标签之后多缩进一级。
- 输入左括号或引号时补上另一半，有选区时用它们包住选区。
- 标出光标旁的括号和与它配对的括号，找不到配对时标为红色。
- 按 `Mod` + `/` 注释或取消注释所在的行。

`Mod` 在 Apple 设备上是 `⌘`，在其他系统上是 `Ctrl`。

`closeBrackets` 设为 `false` 关闭括号补全，`matchBrackets` 设为 `false` 关闭括号配对标记。

## 只读与禁用

`readonly` 让编辑器只能选择和复制，`disabled` 让编辑器不能获得焦点。`placeholder` 设置内容为空时的提示文字。

<DocDemo src="code/state" column />

## 外观

`lineNumbers` 控制是否显示行号，`activeLine` 控制是否给光标所在行加底色。`tabSize` 设置制表位宽度，也是一级缩进的宽度；`indentWithTabs` 设为 `true` 时用制表符缩进。

字号、行高、背景色等通过 CSS 变量调整，见下方 [CSS 变量](#css-变量)。行高请使用整数像素。

## 在其他组件中使用

以下生态包提供了基于代码编辑器的版本，都在各自的 `code` 子路径中：

| 用在哪里   | 引入                                               | 文档                                                                         |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| 块编辑器   | `codeEditorBlock` from `@dou-ui/editor/code`       | [代码块](/editor/code-block#用代码编辑器编辑)                                |
| 电子表格   | `DouSheetCodeFormulaBar` from `@dou-ui/sheet/code` | [代码版编辑栏](/sheet/formulas#代码版编辑栏)                                 |
| 表单设计器 | `codeExpressions` from `@dou-ui/form-builder/code` | [用代码输入框写表达式](/form-builder/builder-inspector#用代码输入框写表达式) |

完整的页面示例见区块[代码练习](/blocks/code-practice)和[配置编辑](/blocks/config-editor)。

## API

### CodeEditor Props

| 名称                | 说明                                                                     | 类型                               | 默认值                |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------- | --------------------- |
| `v-model`           | 代码；`v-model.lazy` 在失去焦点时才更新                                  | `string`                           | —                     |
| `v-model:doc`       | 以 `CodeText` 绑定代码，见[大文件](./performance)                        | `CodeText`                         | —                     |
| `v-model:selection` | 选区，见[选区](./editing#选区)                                           | `CodeSelection`                    | 开头的光标            |
| `language`          | 语言，见[语言](./languages)                                              | `CodeLanguage \| null`             | —                     |
| `readonly`          | 只读                                                                     | `boolean`                          | `false`               |
| `disabled`          | 禁用                                                                     | `boolean`                          | `false`               |
| `placeholder`       | 内容为空时的提示文字                                                     | `string`                           | —                     |
| `lineNumbers`       | 显示行号                                                                 | `boolean`                          | `true`                |
| `gutter`            | 显示行号左侧的栏（行号、折叠箭头、问题图标）；关闭后问题只有波浪线       | `boolean`                          | `true`                |
| `activeLine`        | 给光标所在行加底色                                                       | `boolean`                          | `true`                |
| `tabSize`           | 制表位宽度                                                               | `number`                           | `2`                   |
| `indentWithTabs`    | 用制表符缩进                                                             | `boolean`                          | `false`               |
| `tabIndents`        | `Tab` 用于缩进；关闭后 `Tab` 移到下一个控件，补全和片段中仍然可用        | `boolean`                          | `true`                |
| `closeBrackets`     | 输入括号和引号时补上另一半                                               | `boolean`                          | `true`                |
| `matchBrackets`     | 标出光标旁的括号和它的配对                                               | `boolean`                          | `true`                |
| `searchable`        | 提供查找替换面板，见[查找与替换](./editing#查找与替换)                   | `boolean`                          | `true`                |
| `wrap`              | 长行自动换行                                                             | `boolean`                          | `false`               |
| `foldable`          | 允许折叠代码                                                             | `boolean`                          | `true`                |
| `minimap`           | 在右侧显示小地图，编辑器窄于 480px 时不显示                              | `boolean`                          | `false`               |
| `worker`            | 在 Web Worker 中分析语法，见[大文件](./performance#在-worker-中分析语法) | `boolean \| (() => Worker)`        | `false`               |
| `keys`              | 触屏上键盘上方的符号栏，见[手机触控](./touch)                            | `boolean \| (CodeKey \| string)[]` | `true`                |
| `keymap`            | 额外的快捷键，优先于内置快捷键，见[用代码修改](./transactions#快捷键)    | `CodeKeymap`                       | —                     |
| `extensions`        | 扩展，见[扩展](./extensions)                                             | `CodeExtension[]`                  | —                     |
| `diagnostics`       | 要显示的问题，见[诊断](./assist#诊断)                                    | `CodeDiagnostic[]`                 | —                     |
| `teleport`          | 补全列表、说明和触屏把手的渲染位置；`false` 时在编辑器内，可能被裁掉     | `string \| HTMLElement \| false`   | 全局配置，否则 `body` |
| `messages`          | 改写编辑器中的文字（符号栏、工具条等），默认跟随 ConfigProvider 的语言   | `Partial<CodeMessages>`            | —                     |
| `autofocus`         | 挂载后获得焦点                                                           | `boolean`                          | `false`               |
| `ariaLabel`         | 读屏读出的名称                                                           | `string`                           | —                     |

### CodeEditor Events

| 名称          | 说明                                           | 参数                                    |
| ------------- | ---------------------------------------------- | --------------------------------------- |
| `transaction` | 文字或选区变化后触发，包括撤销和外部传入的新值 | `CodeTransactionResult`                 |
| `foldChange`  | 折叠状态变化时触发                             | `number[]`（各段的起始行号，从 1 开始） |
| `focus`       | 获得焦点时触发                                 | `FocusEvent`                            |
| `blur`        | 失去焦点时触发                                 | `FocusEvent`                            |

### CodeEditor Exposes

| 名称                           | 说明                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| `state`、`doc`、`selection`    | 当前的文本与选区                                               |
| `transact(run, meta?)`         | 做一次修改，返回结果，见[用代码修改](./transactions)           |
| `run(command)`                 | 执行一个命令                                                   |
| `undo()`、`redo()`             | 撤销、重做，返回是否执行                                       |
| `canUndo`、`canRedo`           | 能否撤销、重做                                                 |
| `select(anchor, head?)`        | 选中一段或放置光标，也可以传入整个选区；会滚动到可见           |
| `scrollIntoView(pos?)`         | 把某个位置（默认是主光标）滚动到可见                           |
| `coordsAtPos(pos)`             | 某个位置在视口中的坐标；所在行没有绘制时返回 `null`            |
| `posAtCoords({ x, y })`        | 视口中某一点最近的文本位置                                     |
| `focus()`、`blur()`            | 获得、失去焦点                                                 |
| `openSearch(query?)`           | 打开查找面板；`searchable` 关闭时返回 `false`                  |
| `closeSearch()`                | 关闭查找面板；没有打开时返回 `false`                           |
| `fold(line?)`、`unfold(line?)` | 折叠、展开某一行开始的一段，不传时用光标所在行；返回是否有变化 |
| `foldAll()`、`unfoldAll()`     | 折叠所有最外层的段、全部展开；返回是否有变化                   |
| `folds`                        | 当前折叠的各段的起始行号                                       |
| `diagnostics`                  | 当前的所有问题，按位置排序                                     |

### CSS 变量

| 变量                            | 说明                           | 默认值                        |
| ------------------------------- | ------------------------------ | ----------------------------- |
| `--dou-code-editor-font-size`   | 字号                           | `var(--dou-font-size-sm)`     |
| `--dou-code-editor-line-height` | 行高，请使用整数像素           | `20px`                        |
| `--dou-code-editor-padding-y`   | 第一行上方和最后一行下方的空白 | `8px`                         |
| `--dou-code-editor-padding-x`   | 每行左右的空白                 | `12px`                        |
| `--dou-code-editor-bg`          | 背景色                         | `var(--dou-color-bg-surface)` |
| `--dou-code-editor-selection`   | 选区颜色                       | 主色的浅色                    |
| `--dou-code-editor-active-line` | 光标所在行的底色               | 文字色的 4%                   |

浮在页面上的补全列表、说明和提示会带上编辑器上的字号、背景色、选区颜色和问题颜色（`--dou-code-editor-error`、`--dou-code-editor-warning`、`--dou-code-editor-info`），在编辑器上设置即可。

语法颜色见[语言 · 颜色](./languages#颜色)。
