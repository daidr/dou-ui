# ChatMessage 对话消息

对话中的一条消息，由多个片段组成：文字、思考过程、工具调用、执行步骤、任务计划、引用来源、文件、产物、操作确认和选项提问可以按任意顺序排列。

## 基础用法

`sender` 是发送方：`user` 显示为右侧的气泡，`assistant` 占满整行、不画气泡，`system` 居中显示为一行小字。

`parts` 是片段数组，每个片段用 `type` 区分。只有一段文字时可以直接用 `content`。

<DocDemo src="chat-message/basic" column />

## 片段类型

| `type`      | 渲染为                                | 主要字段                                                                |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `text`      | [StreamText](./stream-text)           | `text`、`streaming`                                                     |
| `reasoning` | [ChatReasoning](./chat-reasoning)     | `text`、`thinking`、`duration`                                          |
| `tool`      | [ChatToolCall](./chat-tool-call)      | `name`、`title`、`status`、`input`、`output`、`live`                    |
| `steps`     | [ChatSteps](./chat-steps)             | `items`、`live`、`title`                                                |
| `plan`      | [ChatPlan](./chat-plan)               | `items`、`title`、`collapsible`、`live`                                 |
| `sources`   | [ChatSources](./chat-sources)         | `items`                                                                 |
| `files`     | [ChatAttachments](./chat-attachments) | `files`                                                                 |
| `artifact`  | [ChatArtifact](./chat-artifact)       | `id`、`title`、`kind`、`description`、`status`、`active`                |
| `confirm`   | [ChatConfirm](./chat-confirm)         | `id`、`title`、`description`、`status`、`allowAlways`、`tone`、`detail` |
| `question`  | [ChatQuestion](./chat-question)       | `id`、`title`、`description`、`options`、`status`、`answer`             |

用户消息里的 `files` 片段显示在气泡上方。确认片段被回答时触发 `confirm`，选项提问被回答时触发 `question`，产物卡片被点击时触发 `artifact`，参数里都有这个片段本身，可以用 `id` 区分。

## 生成中

`loading` 表示还没有收到任何内容，显示三个跳动的圆点。有片段正在输出（`streaming`、`thinking`，或执行步骤、任务计划、工具调用正在运行，即画面上在转圈）时，消息带 `aria-busy`，并且暂时不显示底部操作。

<DocDemo src="chat-message/loading" column />

## 操作

助手消息下方默认始终显示操作，用户消息默认在鼠标悬停时显示，可以用 `actions-visible` 调整。内置的操作有：

- 复制：`copyable` 默认开启，复制所有文字片段。
- 编辑：用户消息设置 `editable` 后出现编辑按钮，在原位改写，回车或点击发送触发 `edit`，Esc 取消。
- 版本切换：`versions` 大于 1 时显示 ‹ 2 / 3 ›，用 `v-model:version` 绑定当前版本，适合重新生成后在几个回答之间切换。

`actions` 插槽可以追加重新生成、点赞这类按钮。

<DocDemo src="chat-message/actions" column />

### 显示时机

`actions-visible` 决定操作何时显示：`'always'` 始终显示，`'hover'` 在鼠标悬停或焦点在消息内时显示，`actions` 插槽追加的按钮也一样。不设置时，用户消息为 `'hover'`，其余消息为 `'always'`。想让整个对话统一，在插件选项或 [ConfigProvider](./config-provider) 的 `defaults` 里设置一次：

```ts
app.use(DouUI, {
  defaults: {
    DouChatMessage: { actionsVisible: 'hover' },
  },
})
```

`'hover'` 下操作隐藏时仍然占着位置，显示出来时不会挤动下面的消息。触屏等无法悬停的设备上，操作始终显示。

<DocDemo src="chat-message/actions-hover" column />

## Markdown

设置 `markdown` 后，文字和思考过程片段用 [Markdown](./markdown) 渲染，流式输出同样适用；正文中的 `[1]` 显示为消息里 `sources` 片段对应来源的角标。

`markdown` 也可以是一个对象，传入 Markdown 组件的 `sanitizeUrl`、`linkTarget`、`smooth`、`speed`、`caret`。Markdown 组件的插槽加上 `markdown-` 前缀就能在这里使用，比如用 `#markdown-code-mermaid` 把图表代码交给自己的组件。更多写法见 Markdown 的[在对话中使用](./markdown#在对话中使用)。

<DocDemo src="chat-message/markdown" column />

## 自定义渲染

`text` 插槽完全接管文字片段的渲染，写了它之后 `markdown` 不再作用于文字片段。参数里的 `text` 是已经逐字显示出来的部分，`part.text` 是全部文字，`sources` 是消息里的来源。下面的例子把 `[1]` 换成 [ChatCitation](./chat-sources#角标引用)。

不认识的 `type` 交给 `part` 插槽渲染，适合天气卡片、图表这类应用自己的内容。

<DocDemo src="chat-message/custom" column />

## API

### Props

| 名称              | 说明                                                     | 类型                                | 默认值                              |
| ----------------- | -------------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| `sender`          | 发送方                                                   | `'user' \| 'assistant' \| 'system'` | `'assistant'`                       |
| `parts`           | 片段数组                                                 | `ChatMessagePart[]`                 | —                                   |
| `content`         | 只有一段文字时的简写                                     | `string`                            | —                                   |
| `loading`         | 还没有收到内容，显示等待圆点                             | `boolean`                           | `false`                             |
| `copyable`        | 显示复制按钮                                             | `boolean`                           | `true`                              |
| `actions-visible` | 操作何时显示，无法悬停的设备始终显示                     | `'always' \| 'hover'`               | 用户消息 `'hover'`，其余 `'always'` |
| `markdown`        | 文字和思考过程片段按 Markdown 渲染，对象为 Markdown 选项 | `boolean \| ChatMessageMarkdown`    | `false`                             |
| `editable`        | 用户消息显示编辑按钮                                     | `boolean`                           | `false`                             |
| `versions`        | 共有几个版本，大于 1 时显示切换器                        | `number`                            | `1`                                 |
| `version`         | 当前版本，从 1 开始，配合 `v-model:version`              | `number`                            | 最后一个版本                        |

### Events

| 名称             | 说明               | 参数                                                                 |
| ---------------- | ------------------ | -------------------------------------------------------------------- |
| `update:version` | 切换了版本         | `(version: number)`                                                  |
| `edit`           | 保存了编辑后的消息 | `(text: string)`                                                     |
| `confirm`        | 回答了确认片段     | `(part: ChatConfirmPart, decision: 'approve' \| 'always' \| 'deny')` |
| `artifact`       | 点击了产物片段     | `(part: ChatArtifactPart)`                                           |
| `question`       | 回答了选项提问片段 | `(part: ChatQuestionPart, value: string \| number)`                  |

### Slots

| 名称         | 说明                                                         |
| ------------ | ------------------------------------------------------------ |
| `text`       | 渲染文字片段，参数为 `{ part, text, index, sources }`        |
| `markdown-*` | Markdown 组件的同名插槽，如 `markdown-code`、`markdown-link` |
| `part`       | 渲染未知类型的片段，参数为 `{ part, index }`                 |
| `actions`    | 追加在内置操作后面的按钮                                     |
| `default`    | 替换全部片段，自己排版                                       |
