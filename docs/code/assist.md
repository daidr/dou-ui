# 诊断与补全

通过扩展提供问题检查、补全列表、悬停说明和参数提示。已有语言服务时，可以直接使用[语言服务](./lsp)。

## 诊断

问题显示为文字下的波浪线、行号左侧的图标和滚动条上的标记。鼠标悬停时显示说明和修复办法。

<DocDemo src="code/lint" column />

问题有两个来源：

- `diagnostics` 属性传入的问题。
- 扩展的 `lint` 返回的问题。`lint` 在挂载时运行，之后在文字停止变化片刻后再次运行，可以返回 Promise。

两种来源的问题都按下面的方式处理：

- 已经找到的问题会跟随后续的修改移动，直到下一次检查或传入新的 `diagnostics`。
- 异步的 `lint` 返回时如果文字已经改变，这次结果会被丢弃。
- 问题由外部推送（例如语言服务）时，调用上下文的 `relint(name)` 让对应扩展的 `lint` 立即重新运行。
- `F8` / `Shift` + `F8` 跳到下一个 / 上一个问题，`Mod` + `.` 显示光标处问题的修复办法。触屏上点击有问题的文字即可显示说明。

## 补全

扩展的 `completion` 提供补全列表，`hover` 提供悬停说明，`signature` 提供参数提示。

<DocDemo src="code/completion" column />

`completion` 在输入时调用，返回 `{ from, options }`。`from` 是补全替换的起点，从 `from` 到光标的文字用于筛选 `options`：开头一致的排在前面，其次是按词首字母匹配的，例如 `gebi` 能找到 `getElementById`。

- `completionTriggers` 设置输入后也弹出补全的字符，例如 `['.']`。
- 按 `Ctrl` + `Space` 或 `Alt` + `Esc` 主动打开补全，此时参数中的 `explicit` 为 `true`。
- 列表打开时，`↑` `↓` 选择，`Enter` 或 `Tab` 插入，`Esc` 关闭。
- 继续输入时，编辑器先用已有的结果重新筛选，同时再次调用 `completion`。旧的请求会被丢弃，`signal` 随之中止。

### 代码片段

补全项的 `snippet` 是带占位的片段：

- `${1:name}` 是第 1 个占位，预先填着 `name`；再次出现的 `$1` 会同步填写。
- `$0` 是最后光标停下的位置。
- 插入后选中第一个占位，`Tab` / `Shift` + `Tab` 在占位之间跳转，按 `Esc` 或到达 `$0` 后结束。

## 悬停说明与参数提示

`hover` 在鼠标停在文字上或按 `Mod` + `I` 时调用，返回 `{ content }`，`content` 可以是文字或渲染函数。同一位置的问题会显示在同一个说明框中。

`signature` 在光标移动或输入 `(`、`,` 时调用，返回 `{ label, params, active }`。`params` 是各个参数在 `label` 中的 `[from, to]`，`active` 是正在填写的参数，会加粗显示。

## 在 worker 中计算

补全和检查耗时较长时，可以放进 Web Worker。扩展只负责发送请求并返回 Promise，文字改变后编辑器会丢弃旧的结果。

<DocDemo src="code/worker" column />

示例中每次向 worker 发送整段文本。文件很大时，可以改为只发送 `transaction` 事件中的 `changes`，由 worker 维护一份副本。

## API

### CodeDiagnostic

| 名称       | 说明                                           | 类型                                       |
| ---------- | ---------------------------------------------- | ------------------------------------------ |
| `from`     | 起始位置                                       | `number`                                   |
| `to`       | 结束位置                                       | `number`                                   |
| `severity` | 严重程度                                       | `'error' \| 'warning' \| 'info' \| 'hint'` |
| `message`  | 说明                                           | `string`                                   |
| `source`   | 来源，显示在说明之后                           | `string`                                   |
| `actions`  | 修复办法 `{ label, run(context, diagnostic) }` | `CodeDiagnosticAction[]`                   |

### 扩展字段

| 名称                 | 参数                                         | 返回值                                                       |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `lint`               | `context`                                    | `CodeDiagnostic[]`，可以是 Promise                           |
| `completion`         | `{ pos, word, explicit, signal }`、`context` | `{ from, options }` 或 `null`，可以是 Promise                |
| `completionTriggers` | —                                            | `string[]`                                                   |
| `hover`              | `{ pos, signal }`、`context`                 | `{ from?, to?, content }` 或 `null`，可以是 Promise          |
| `signature`          | `{ pos, signal }`、`context`                 | `{ label, params, active, info? }` 或 `null`，可以是 Promise |

`word` 是光标前的词 `{ from, to, text }`。

### CodeCompletion

| 名称      | 说明                             | 类型                           |
| --------- | -------------------------------- | ------------------------------ |
| `label`   | 显示的文字，也用于筛选           | `string`                       |
| `kind`    | 种类，决定前面的图标             | `CodeCompletionKind`           |
| `detail`  | 显示在右侧的简短说明，例如类型   | `string`                       |
| `info`    | 选中时显示在列表下方的说明       | `string \| (() => VNodeChild)` |
| `insert`  | 实际插入的文字，默认等于 `label` | `string`                       |
| `snippet` | 以代码片段插入                   | `string`                       |
| `boost`   | 在匹配程度相同的项中调整排序     | `number`                       |

`kind` 可以是 `keyword`、`function`、`method`、`variable`、`property`、`constant`、`class`、`type`、`module`、`snippet`、`text`。
