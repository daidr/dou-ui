# 代码输入框

`DouCodeInput` 是和输入框等高的代码编辑器，用于输入表达式、公式这类一两行的代码。

## 基础用法

<DocDemo src="code/input" column />

代码输入框没有行号和折叠。`Tab` 和普通输入框一样移到下一个控件。补全列表、说明和参数提示默认渲染到 `body`，不会被输入框遮挡。

## 单行与多行

默认只有一行：按 `Enter` 触发 `enter` 事件，粘贴进来的换行会变为空格，内容超出宽度时横向滚动。

加上 `multiline` 后可以换行，输入框随内容增高，超过 `autosize.maxRows` 行后滚动。此时按 `Mod` + `Enter` 触发 `enter` 事件。

## 在表单中使用

放在 `DouFormItem` 中时，代码输入框和 `DouInput` 一样使用表单项的 `id`、说明和校验状态，`size`、`disabled` 和 `readonly` 也跟随表单。

## API

### CodeInput Props

| 名称            | 说明                                                                 | 类型                                     | 默认值                       |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| `v-model`       | 代码；单行时换行会变为空格                                           | `string`                                 | —                            |
| `multiline`     | 允许多行，随内容增高                                                 | `boolean`                                | `false`                      |
| `autosize`      | 多行时最少、最多显示的行数                                           | `{ minRows?: number, maxRows?: number }` | `{ minRows: 1, maxRows: 6 }` |
| `size`          | 尺寸                                                                 | `'sm' \| 'md' \| 'lg'`                   | 跟随表单，否则 `'md'`        |
| `invalid`       | 显示为错误状态                                                       | `boolean`                                | `false`                      |
| `disabled`      | 禁用                                                                 | `boolean`                                | 跟随表单，否则 `false`       |
| `readonly`      | 只读                                                                 | `boolean`                                | 跟随表单，否则 `false`       |
| `placeholder`   | 为空时的提示文字                                                     | `string`                                 | —                            |
| `language`      | 语言                                                                 | `CodeLanguage \| null`                   | —                            |
| `extensions`    | 扩展                                                                 | `CodeExtension[]`                        | —                            |
| `diagnostics`   | 要显示的问题                                                         | `CodeDiagnostic[]`                       | —                            |
| `keymap`        | 额外的快捷键                                                         | `CodeKeymap`                             | —                            |
| `closeBrackets` | 输入括号和引号时补上另一半                                           | `boolean`                                | `true`                       |
| `tabSize`       | 制表位宽度                                                           | `number`                                 | `2`                          |
| `teleport`      | 补全列表、说明和触屏把手的渲染位置；`false` 时在输入框内，可能被裁掉 | `string \| HTMLElement \| false`         | 全局配置，否则 `body`        |
| `keys`          | 触屏上键盘上方的符号栏                                               | `boolean \| (CodeKey \| string)[]`       | `false`                      |
| `messages`      | 改写界面上的文字                                                     | `Partial<CodeMessages>`                  | —                            |
| `autofocus`     | 挂载后获得焦点                                                       | `boolean`                                | `false`                      |
| `ariaLabel`     | 读屏读出的名称                                                       | `string`                                 | —                            |

### CodeInput Events

| 名称          | 说明                                                         | 参数                    |
| ------------- | ------------------------------------------------------------ | ----------------------- |
| `enter`       | 单行时按 `Enter`、多行时按 `Mod` + `Enter`，且补全列表未打开 | —                       |
| `transaction` | 文字或选区变化后触发                                         | `CodeTransactionResult` |
| `focus`       | 获得焦点时触发                                               | `FocusEvent`            |
| `blur`        | 失去焦点时触发                                               | `FocusEvent`            |

实例的属性和方法与 [DouCodeEditor](./#codeeditor-exposes) 相同。
