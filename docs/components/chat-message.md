# ChatMessage 对话消息

对话中的一条消息，由多个片段组成：文字、思考过程、工具调用、执行步骤、任务计划、引用来源、文件、产物和操作确认可以按任意顺序排列。

## 基础用法

`sender` 是发送方：`user` 显示为右侧的气泡，`assistant` 占满整行、不画气泡，`system` 居中显示为一行小字。

`parts` 是片段数组，每个片段用 `type` 区分。只有一段文字时可以直接用 `content`。

<DocDemo src="chat-message/basic" column />

## 片段类型

| `type`      | 渲染为                                | 主要字段                                                                  |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `text`      | [StreamText](./stream-text)           | `text`、`streaming`                                                       |
| `reasoning` | [ChatReasoning](./chat-reasoning)     | `text`、`thinking`、`duration`                                            |
| `tool`      | [ChatToolCall](./chat-tool-call)      | `name`、`title`、`status`、`input`、`output`                              |
| `steps`     | [ChatSteps](./chat-steps)             | `items`、`running`、`title`                                               |
| `plan`      | [ChatPlan](./chat-plan)               | `items`、`title`                                                          |
| `sources`   | [ChatSources](./chat-sources)         | `items`                                                                   |
| `files`     | [ChatAttachments](./chat-attachments) | `files`                                                                   |
| `artifact`  | [ChatArtifact](./chat-artifact)       | `id`、`title`、`kind`、`description`、`status`、`active`                  |
| `confirm`   | [ChatConfirm](./chat-confirm)         | `id`、`title`、`description`、`status`、`allowAlways`、`danger`、`detail` |

用户消息里的 `files` 片段显示在气泡上方。确认片段被回答时触发 `confirm`，产物卡片被点击时触发 `artifact`，参数里都有这个片段本身，可以用 `id` 区分。

## 生成中

`pending` 表示还没有收到任何内容，显示三个跳动的圆点。有片段正在输出（`streaming`、`thinking`、`running` 或工具状态为 `running`）时，消息带 `aria-busy`，并且暂时不显示底部操作。

<DocDemo src="chat-message/pending" column />

## 操作

助手消息下方始终显示操作，用户消息在鼠标悬停时显示。内置的操作有：

- 复制：`copyable` 默认开启，复制所有文字片段。
- 编辑：用户消息设置 `editable` 后出现编辑按钮，在原位改写，回车或点击发送触发 `edit`，Esc 取消。
- 版本切换：`versions` 大于 1 时显示 ‹ 2 / 3 ›，用 `v-model:version` 绑定当前版本，适合重新生成后在几个回答之间切换。

`actions` 插槽可以追加重新生成、点赞这类按钮。

<DocDemo src="chat-message/actions" column />

## 自定义渲染

`text` 插槽接管文字片段的渲染，参数里的 `text` 是已经逐字显示出来的部分，可以交给 Markdown 渲染器，或者像下面这样把 `[1]` 换成 [ChatCitation](./chat-sources#角标引用)。

不认识的 `type` 交给 `part` 插槽渲染，适合天气卡片、图表这类应用自己的内容。

<DocDemo src="chat-message/custom" column />

## API

### Props

| 名称       | 说明                                        | 类型                                | 默认值        |
| ---------- | ------------------------------------------- | ----------------------------------- | ------------- |
| `sender`   | 发送方                                      | `'user' \| 'assistant' \| 'system'` | `'assistant'` |
| `parts`    | 片段数组                                    | `ChatMessagePart[]`                 | —             |
| `content`  | 只有一段文字时的简写                        | `string`                            | —             |
| `pending`  | 还没有收到内容，显示等待圆点                | `boolean`                           | `false`       |
| `copyable` | 显示复制按钮                                | `boolean`                           | `true`        |
| `editable` | 用户消息显示编辑按钮                        | `boolean`                           | `false`       |
| `versions` | 共有几个版本，大于 1 时显示切换器           | `number`                            | `1`           |
| `version`  | 当前版本，从 1 开始，配合 `v-model:version` | `number`                            | 最后一个版本  |

### Events

| 名称             | 说明               | 参数                                                                 |
| ---------------- | ------------------ | -------------------------------------------------------------------- |
| `update:version` | 切换了版本         | `(version: number)`                                                  |
| `edit`           | 保存了编辑后的消息 | `(text: string)`                                                     |
| `confirm`        | 回答了确认片段     | `(part: ChatConfirmPart, decision: 'approve' \| 'always' \| 'deny')` |
| `artifact`       | 点击了产物片段     | `(part: ChatArtifactPart)`                                           |

### Slots

| 名称      | 说明                                         |
| --------- | -------------------------------------------- |
| `text`    | 渲染文字片段，参数为 `{ part, text, index }` |
| `part`    | 渲染未知类型的片段，参数为 `{ part, index }` |
| `actions` | 追加在内置操作后面的按钮                     |
| `default` | 替换全部片段，自己排版                       |
