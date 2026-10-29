# ChatInput 对话输入框

对话底部的输入框，回车发送，随内容自动增高。

## 基础用法

用 `v-model` 绑定文字。按回车或点击发送按钮时触发 `submit`，参数是当前文字；清空输入框由你在 `submit` 里完成。Shift + 回车换行，输入法正在组词时按回车不会发送。

文字为空白时不能发送。

<DocDemo src="chat-input/basic" column />

## 生成中

`loading` 为 `true` 时发送按钮变成停止按钮，点击触发 `stop`。生成期间仍然可以继续输入，输入框里有内容时按钮会变回发送，按回车或点击都会触发 `submit`，可以由应用把这条消息排在当前回答之后。

<DocDemo src="chat-input/loading" column />

## 工具与附件

`actions` 插槽在底部左侧，适合放添加附件、联网搜索、选择模型这类按钮。`header` 插槽在文字上方，可以放 [ChatAttachments](./chat-attachments)。

在输入框里粘贴文件，或把文件拖进来时，会触发 `attach`，参数是文件列表。只有附件没有文字也想允许发送时，用 `can-submit` 自己决定能否发送。

<DocDemo src="chat-input/actions" column />

## 命令与引用

`commands` 是以 `/` 开头时弹出的命令菜单，选中后输入的 `/…` 会被删掉，并触发 `command`，应用可以据此切换模式，比如在 `header` 插槽里显示一个标签。`mentions` 是输入 `@` 后弹出的引用菜单，选中后会把输入的 `@…` 换成 `@值 ` 并触发 `mention`。

菜单可以用上下方向键选择，回车或 Tab 确认，Esc 关闭。

<DocDemo src="chat-input/commands" column />

## 发送快捷键

`submit-on="mod-enter"` 时回车换行，Ctrl / ⌘ + 回车发送，适合经常输入多行内容的场景。`min-rows` 和 `max-rows` 控制最少显示几行、最多增高到几行。

<DocDemo src="chat-input/mod-enter" column />

## API

### Props

| 名称          | 说明                                 | 类型                     | 默认值         |
| ------------- | ------------------------------------ | ------------------------ | -------------- |
| `modelValue`  | 文字，配合 `v-model`                 | `string`                 | `''`           |
| `placeholder` | 占位文字                             | `string`                 | 语言包中的提示 |
| `submitOn`    | 发送的按键                           | `'enter' \| 'mod-enter'` | `'enter'`      |
| `loading`     | 正在生成，发送按钮变成停止按钮       | `boolean`                | `false`        |
| `disabled`    | 禁用                                 | `boolean`                | `false`        |
| `minRows`     | 最少显示的行数                       | `number`                 | `1`            |
| `maxRows`     | 最多增高到的行数，超出后滚动         | `number`                 | `8`            |
| `canSubmit`   | 能否发送；不设置时文字非空白才能发送 | `boolean`                | —              |

其余属性会传给内部的 `<textarea>`，比如 `maxlength`、`autofocus`。

### Events

| 名称                | 说明                     | 参数              |
| ------------------- | ------------------------ | ----------------- |
| `update:modelValue` | 文字变化                 | `(value: string)` |
| `submit`            | 按下发送键或点击发送按钮 | `(value: string)` |
| `stop`              | 生成中点击停止按钮       | —                 |
| `attach`            | 粘贴或拖入了文件         | `(files: File[])` |

### Slots

| 名称      | 说明                                                              |
| --------- | ----------------------------------------------------------------- |
| `header`  | 文字上方，比如附件                                                |
| `actions` | 底部左侧的工具按钮                                                |
| `option`  | 替换菜单中每一项的内容，参数为 `{ option, trigger }`              |
| `submit`  | 替换发送 / 停止按钮，参数为 `{ submit, stop, loading, disabled }` |

### ChatInputOption

| 名称          | 说明                                 | 类型        |
| ------------- | ------------------------------------ | ----------- |
| `value`       | 匹配和返回的值，引用时也是插入的文字 | `string`    |
| `label`       | 菜单中显示的文字，默认为 `value`     | `string`    |
| `description` | 文字后面的说明                       | `string`    |
| `icon`        | 图标组件                             | `Component` |
| `disabled`    | 禁用                                 | `boolean`   |

### Exposes

| 名称       | 说明               | 类型                          |
| ---------- | ------------------ | ----------------------------- |
| `textarea` | 原生 `<textarea>`  | `HTMLTextAreaElement \| null` |
| `focus`    | 聚焦               | `() => void`                  |
| `blur`     | 失焦               | `() => void`                  |
| `submit`   | 按发送键的效果发送 | `() => void`                  |
