# Editable 行内编辑

平时显示为文字，点击后在原处变成输入框，适合标题重命名、表格单元格这类就地修改。

## 基础用法

点击文字进入编辑，`Enter` 保存，`Esc` 取消。`v-model` 只在确认保存时更新，编辑中的内容不会写回。离开输入框时默认保存，`blur-action="cancel"` 改为放弃。

文字和输入框占据同样的位置，进入编辑时周围的内容不会移动，字号和字重沿用外层元素。值为空时显示 `placeholder`。

`multiline` 使用会随内容长高的多行输入框，此时 `Enter` 换行，`Ctrl + Enter`（macOS 上为 `⌘ + Enter`）保存。使用输入法组词时按 `Enter` 不会保存。

<DocDemo src="editable/basic" />

## 校验

`validate` 在保存前检查新内容，返回 `false` 或一段文字时保持编辑状态，文字作为错误信息显示在输入框下方。可以返回 Promise，用于需要请求接口的检查。

<DocDemo src="editable/validate" />

## 打开方式

`trigger` 设置用鼠标打开的方式，可选 `click`（默认）和 `dblclick`。用 `v-model:editing` 可以从外部打开，例如放一个“重命名”按钮。

<DocDemo src="editable/manual" />

## 键盘与读屏

文字是一个可聚焦的按钮，按 `Enter` 或 `F2` 进入编辑，读屏会在文字后读出“按 Enter 编辑”。用键盘保存或取消后，焦点回到文字上。输入框里的 `Esc` 只结束编辑，不会关闭外层的对话框或抽屉。

## API

### Props

| 名称           | 说明                                          | 类型                                                         | 默认值     |
| -------------- | --------------------------------------------- | ------------------------------------------------------------ | ---------- |
| `modelValue`   | 保存的文字，配合 `v-model`                    | `string`                                                     | `''`       |
| `editing`      | 是否在编辑，配合 `v-model:editing`            | `boolean`                                                    | `false`    |
| `placeholder`  | 值为空时显示的文字                            | `string`                                                     | —          |
| `multiline`    | 多行编辑                                      | `boolean`                                                    | `false`    |
| `trigger`      | 用鼠标打开的方式                              | `'click' \| 'dblclick'`                                      | `'click'`  |
| `blurAction`   | 离开输入框时保存还是放弃                      | `'submit' \| 'cancel'`                                       | `'submit'` |
| `validate`     | 保存前检查；返回 `false` 或错误信息时保持编辑 | `(value: string) => boolean \| string \| void \| Promise<…>` | —          |
| `selectOnEdit` | 进入编辑时选中全部文字                        | `boolean`                                                    | `true`     |
| `maxlength`    | 最大长度                                      | `number`                                                     | —          |
| `disabled`     | 禁用；放在禁用的表单里时同样禁用              | `boolean`                                                    | `false`    |
| `ariaLabel`    | 输入框的无障碍名称，也会读在文字前面          | `string`                                                     | —          |

`class` 和 `style` 作用在外层，其余属性（如 `name`、`inputmode`、`autocomplete`）传给编辑时的输入框。

### Events

| 名称                | 说明                             | 参数                 |
| ------------------- | -------------------------------- | -------------------- |
| `update:modelValue` | 保存了不同的内容                 | `(value: string)`    |
| `update:editing`    | 进入或结束编辑                   | `(editing: boolean)` |
| `submit`            | 确认保存，内容没有变化时也会触发 | `(value: string)`    |
| `cancel`            | 放弃编辑                         | —                    |

### Slots

| 名称      | 说明                                       |
| --------- | ------------------------------------------ |
| `default` | 不在编辑时如何显示；参数 `{ value, edit }` |

### Exposes

| 名称     | 说明                     | 类型                  |
| -------- | ------------------------ | --------------------- |
| `edit`   | 进入编辑                 | `() => void`          |
| `submit` | 保存当前内容，会经过校验 | `() => Promise<void>` |
| `cancel` | 放弃并结束编辑           | `() => void`          |

### CSS 变量

| 变量                       | 说明               |
| -------------------------- | ------------------ |
| `--dou-editable-padding-x` | 文字两侧留出的空间 |
| `--dou-editable-padding-y` | 文字上下留出的空间 |
| `--dou-editable-radius`    | 圆角               |
| `--dou-editable-hover-bg`  | 悬停时文字的底色   |
