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

在输入框里粘贴文件，或把文件拖进来时，会触发 `attach`，参数是文件列表。只有附件没有文字也想允许发送时，用 `canSubmit` 自己决定能否发送。

<DocDemo src="chat-input/actions" column />

## 命令与引用

`commands` 是以 `/` 开头时弹出的命令菜单，选中后输入的 `/…` 会被删掉，并触发 `command`，应用可以据此切换模式，比如在 `header` 插槽里显示一个标签。`mentions` 是输入 `@` 后弹出的引用菜单，选中后会把输入的 `@…` 换成 `@值 ` 并触发 `mention`。

菜单可以用上下方向键选择，回车或 Tab 确认，Esc 或点击外部关闭。菜单和其他[浮层](../guide/overlays)一样渲染在页面最上层，默认在输入框上方，空间不够时换到下方，不会被外层的 `overflow: hidden` 裁掉。

<DocDemo src="chat-input/commands" column />

## 匹配与远程候选

菜单只列出和输入匹配的项，默认按用户看得到的文字匹配，不区分大小写：`label`（没有 `label` 时用 `value`）、引用的 `value`（它会被插入到文字里）、`description`，以及 `keywords`。命令的 `value` 用户看不到，可能只是内部 id，所以有 `label` 时不参与匹配；想让 `/summarize` 也能找到“总结”，把它写进 `keywords`。`filter` 可以传一个函数自己判断，参数为 `(option, query, trigger)`。

候选太多、要按输入去服务端查时，监听 `search`：`/` 或 `@` 后的文字变化后，停顿 `searchDelay`（默认 300ms）触发，刚输入 `/` 或 `@` 时也会触发一次，参数为 `(query, trigger)`；输入法组词期间不触发，按 Esc 关掉菜单后也不再触发，直到输入新的 `/` 或 `@`。把查到的结果换进 `commands` 或 `mentions`，并关掉这一种的本地匹配，免得组件筛掉服务端已经挑好的结果：`:filter="{ '@': false }"` 只关引用，命令照常在本地匹配。

请求是异步的，慢的请求可能比后发的先回来，只采用最后一次查询的结果。每次查到结果都换一个新数组，组件以此判断结果对应哪次输入：输入变了而新结果还没回来时，菜单里仍是上一次的结果，显示为变淡，按回车或 Tab 不会选中，等新结果回来再选。菜单只在有候选时出现：第一批结果回来之前、或者没有查到结果时，菜单不显示。选项里放图标组件时，用 `shallowRef` 或 `markRaw` 保存列表，不要让 Vue 把组件变成响应式对象。

<DocDemo src="chat-input/search" column />

## 发送快捷键

`submit-on="mod-enter"` 时回车换行，Ctrl / ⌘ + 回车发送，适合经常输入多行内容的场景。`minRows` 和 `maxRows` 控制最少显示几行、最多增高到几行。`size` 可选 `sm`、`md`、`lg`，放在侧边栏这类窄的地方时用 `sm`。

<DocDemo src="chat-input/mod-enter" column />

## API

### Props

| 名称          | 说明                                                                                                                                                                     | 类型                                                                              | 默认值         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------- |
| `modelValue`  | 文字，配合 `v-model`                                                                                                                                                     | `string`                                                                          | `''`           |
| `placeholder` | 占位文字                                                                                                                                                                 | `string`                                                                          | 语言包中的提示 |
| `submitOn`    | 发送的按键                                                                                                                                                               | `'enter' \| 'mod-enter'`                                                          | `'enter'`      |
| `loading`     | 正在生成，发送按钮变成停止按钮                                                                                                                                           | `boolean`                                                                         | `false`        |
| `size`        | 文字大小与内边距，圆角和按钮随之变化                                                                                                                                     | `'sm' \| 'md' \| 'lg'`                                                            | `'md'`         |
| `disabled`    | 禁用                                                                                                                                                                     | `boolean`                                                                         | `false`        |
| `minRows`     | 最少显示的行数                                                                                                                                                           | `number`                                                                          | `1`            |
| `maxRows`     | 最多增高到的行数，超出后滚动                                                                                                                                             | `number`                                                                          | `8`            |
| `canSubmit`   | 能否发送；不设置时文字非空白才能发送                                                                                                                                     | `boolean`                                                                         | —              |
| `commands`    | 以 `/` 开头时弹出的命令                                                                                                                                                  | `ChatInputOption[]`                                                               | `[]`           |
| `mentions`    | 输入 `@` 后弹出的引用                                                                                                                                                    | `ChatInputOption[]`                                                               | `[]`           |
| `filter`      | 怎样匹配 `/`、`@` 后的文字；`false` 原样列出全部；可以按触发符分开设置，如 `{ '@': false }`；`ChatInputFilterMode` 为 `boolean \| ((option, query, trigger) => boolean)` | `ChatInputFilterMode \| { '/'?: ChatInputFilterMode; '@'?: ChatInputFilterMode }` | `true`         |
| `searchDelay` | 输入停顿多久后触发 `search`，毫秒                                                                                                                                        | `number`                                                                          | `300`          |
| `teleport`    | 命令与引用菜单渲染到哪里；`false` 为原地渲染                                                                                                                             | `string \| HTMLElement \| false`                                                  | `'body'`       |

其余属性会传给内部的 `<textarea>`，比如 `maxlength`、`autofocus`。

### Events

| 名称                | 说明                                                                                       | 参数                                   |
| ------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| `update:modelValue` | 文字变化                                                                                   | `(value: string)`                      |
| `submit`            | 按下发送键或点击发送按钮                                                                   | `(value: string)`                      |
| `stop`              | 生成中点击停止按钮                                                                         | —                                      |
| `command`           | 从 `/` 菜单选中了一项                                                                      | `(option: ChatInputOption)`            |
| `mention`           | 从 `@` 菜单选中了一项                                                                      | `(option: ChatInputOption)`            |
| `search`            | `/` 或 `@` 后的文字变化（停顿后），以及刚输入 `/` 或 `@` 时；组词期间和按 Esc 关掉后不触发 | `(query: string, trigger: '/' \| '@')` |
| `attach`            | 粘贴或拖入了文件                                                                           | `(files: File[])`                      |

### Slots

| 名称      | 说明                                                              |
| --------- | ----------------------------------------------------------------- |
| `header`  | 文字上方，比如附件                                                |
| `actions` | 底部左侧的工具按钮                                                |
| `option`  | 替换菜单中每一项的内容，参数为 `{ option, trigger }`              |
| `submit`  | 替换发送 / 停止按钮，参数为 `{ submit, stop, loading, disabled }` |

### ChatInputOption

| 名称          | 说明                                                        | 类型        |
| ------------- | ----------------------------------------------------------- | ----------- |
| `value`       | 返回的值，引用时也是插入的文字；命令有 `label` 时不参与匹配 | `string`    |
| `label`       | 菜单中显示并参与匹配的文字，默认为 `value`                  | `string`    |
| `keywords`    | 另外能找到这一项的词，比如英文名、拼音                      | `string[]`  |
| `description` | 文字后面的说明，也参与匹配                                  | `string`    |
| `icon`        | 图标组件                                                    | `Component` |
| `disabled`    | 禁用                                                        | `boolean`   |

### Exposes

| 名称       | 说明               | 类型                          |
| ---------- | ------------------ | ----------------------------- |
| `textarea` | 原生 `<textarea>`  | `HTMLTextAreaElement \| null` |
| `focus`    | 聚焦               | `() => void`                  |
| `blur`     | 失焦               | `() => void`                  |
| `submit`   | 按发送键的效果发送 | `() => void`                  |
