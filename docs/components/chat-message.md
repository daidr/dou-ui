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

`loading` 表示还没有收到任何内容，显示三个跳动的圆点。有片段正在输出（`streaming`、`thinking`，或执行步骤、任务计划、工具调用正在运行，即画面上在转圈）时，消息带 `aria-busy`，并且暂时不显示操作浮条。

<DocDemo src="chat-message/loading" column />

## 操作

操作放在消息右上角上方的小浮条里，占用的是消息之间的间隙：鼠标悬停或用键盘把焦点移进消息时出现，触屏上点一下消息出现，点别处收起。长消息的顶部滚出可视区域后，浮条固定在滚动区域顶部，直到这条消息滚走；在带 `items` 的 [ChatList](./chat-list#大量消息) 里，消息靠变换定位，浮条留在消息顶部，不随滚动固定。内置的操作有：

- 复制：`copyable` 默认开启，复制所有文字片段。
- 编辑：用户消息设置 `editable` 后出现编辑按钮，在原位改写，回车或点击发送触发 `edit`，Esc 取消。
- 版本切换：`versions` 大于 1 时显示 ‹ 2 / 3 ›，用 `v-model:version` 绑定当前版本，适合重新生成后在几个回答之间切换。

`actions` 插槽可以追加重新生成、点赞这类按钮。

<DocDemo src="chat-message/actions" column />

### 显示时机

`actions-visible` 决定浮条何时显示：默认 `'hover'`，在鼠标悬停、键盘焦点在消息内或在触屏上点按消息后显示，`actions` 插槽追加的按钮也一样；`'always'` 让浮条一直显示，这时它留在消息顶部，不随滚动固定，免得一直压着长消息的文字。想让整个对话统一，在插件选项或 [ConfigProvider](./config-provider) 的 `defaults` 里设置一次：

```ts
app.use(DouUI, {
  defaults: {
    DouChatMessage: { actionsVisible: 'always' },
  },
})
```

浮条高出消息 24px，和 [ChatList](./chat-list) 里消息之间的间距一致，所以不会压到上一条消息；ChatList 的顶部内边距也为第一条消息的浮条留了位置。自己排列消息时，消息之间至少留 24px，第一条消息上方也留出 24px。浮条隐藏时不挡点击。在触屏上点按消息里的按钮、链接或者选中文字时，浮条保持原样。

<DocDemo src="chat-message/actions-visible" column />

### 跟在文字后面的标记

“已编辑”这类一直要看得到的小标记，放进 `trailing` 插槽。它跟在最后一个文字片段的最后一个字后面，和文字在同一行，不受 `actions-visible` 影响。生成中时它在光标后面。消息里没有文字片段时，它单独占一行，放在所有片段后面；这时如果 `loading` 还开着，要等加载结束才显示。样式由插槽里的内容自己决定。

<DocDemo src="chat-message/trailing" column />

开了 `markdown` 时，它跟在最后一段、标题、列表项或表格最后一格的末尾，最后一块是引用或 `:::` 自定义块时，它在框里面，和流式光标的位置一致；最后一块是代码块或分隔线时，单独占一行。用 `text` 插槽自己渲染文字时，它放在插槽内容后面；用默认插槽替换全部片段时不显示，需要自己放。

## 回应

`reactions` 显示在消息下方，每一项是一个表情和回应的人数，`reacted` 表示自己也回应过，这一项会带上主题色。人数为 0 的项不显示。`label` 是补充说明，适合写上是谁回应的，悬停提示和读屏都会在表情和人数后面带上它。触屏没有悬停提示，需要在触屏上看到回应的人时，由应用自己提供入口。

点击一项触发 `react`，参数是这个表情。消息本身不改动 `reactions`，由应用决定加上还是收回自己的回应，再把新的数组传回来。

提供 `reaction-picker` 插槽后才会出现“添加回应”按钮，点击后在弹出层里显示插槽的内容。放什么由应用决定，几个常用表情、完整的表情选择器或者自己的贴纸都可以。插槽参数里的 `react(emoji)` 触发 `react` 并关闭弹出层，`close` 只关闭弹出层。消息还没有任何回应时，这个按钮放在操作浮条里，跟着 `actions-visible` 显示，不会给每条消息多占一行；有了回应以后，它跟在回应的最后面。

只想展示、不让人回应时，比如自己发的消息或已归档的对话，把 `reactable` 设为 `false`：回应的样子、位置和悬停提示都不变，只是不能点，也没有“添加回应”按钮。下面第一条是自己的消息，只显示助手的回应。

<DocDemo src="chat-message/reactions" column />

表情默认按文字显示。`emoji` 也可以是应用自己的标识，再用 `reaction` 插槽渲染成图片：

```vue
<DouChatMessage :reactions="reactions" @react="toggle">
  <template #reaction="{ reaction }">
    <img :src="stickers[reaction.emoji]" :alt="reaction.emoji" />
  </template>
</DouChatMessage>
```

可点的回应每一项是一个按钮，带 `aria-pressed` 表示自己是否回应过；读屏软件读出表情、人数和 `label`。`reactable` 为 `false` 时每一项不是按钮，读屏软件同样读出表情、人数和 `label`，也能用 Tab 键聚焦到它看悬停提示。`react` 的第二个参数是 `reactions` 里对应的那一项（在选择面板里选了一个还没有人用过的表情时为 `undefined`）。

同一个表情在 `reactions` 里只能出现一次，开发环境下重复时会在控制台给出警告。

在选择面板里用键盘选了表情后，如果“添加回应”按钮因为出现了第一个回应而移到回应末尾，焦点会跟到新位置。触屏上可点的回应每一项有 40px 高的可点区域。

## 高亮

`highlighted` 给消息加上主题色的描边：用户消息的描边贴着气泡，助手消息的描边在文字外侧 4px。打开时一直显示，关掉后淡出（减少动效时很快消失），所以通常过一两秒再关掉。高亮的消息带 `aria-current="true"`。配合 DouChatList 的 [`scrollToMessage`](./chat-list#定位到某条消息) 使用。

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

| 名称              | 说明                                                                           | 类型                                | 默认值        |
| ----------------- | ------------------------------------------------------------------------------ | ----------------------------------- | ------------- |
| `sender`          | 发送方                                                                         | `'user' \| 'assistant' \| 'system'` | `'assistant'` |
| `parts`           | 片段数组                                                                       | `ChatMessagePart[]`                 | —             |
| `content`         | 只有一段文字时的简写                                                           | `string`                            | —             |
| `loading`         | 还没有收到内容，显示等待圆点                                                   | `boolean`                           | `false`       |
| `copyable`        | 显示复制按钮                                                                   | `boolean`                           | `true`        |
| `actions-visible` | 右上角操作浮条何时显示，`'hover'` 时触屏点按消息显示                           | `'always' \| 'hover'`               | `'hover'`     |
| `markdown`        | 文字和思考过程片段按 Markdown 渲染，对象为 Markdown 选项                       | `boolean \| ChatMessageMarkdown`    | `false`       |
| `editable`        | 用户消息显示编辑按钮                                                           | `boolean`                           | `false`       |
| `versions`        | 共有几个版本，大于 1 时显示切换器                                              | `number`                            | `1`           |
| `version`         | 当前版本，从 1 开始，配合 `v-model:version`                                    | `number`                            | 最后一个版本  |
| `highlighted`     | 用主题色的描边框住这条消息，比如搜索定位到它时；关掉后淡出，减少动效时很快消失 | `boolean`                           | `false`       |
| `reactions`       | 消息下方的回应，见[回应](#回应)                                                | `ChatMessageReaction[]`             | —             |
| `reactable`       | 回应可以点，也可以添加新回应；关掉后只显示，见[回应](#回应)                    | `boolean`                           | `true`        |

### Events

| 名称             | 说明                                              | 参数                                                                            |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `update:version` | 切换了版本                                        | `(version: number)`                                                             |
| `edit`           | 保存了编辑后的消息                                | `(text: string)`                                                                |
| `confirm`        | 回答了确认片段                                    | `(part: ChatConfirmPart, decision: 'approve' \| 'always' \| 'deny')`            |
| `artifact`       | 点击了产物片段                                    | `(part: ChatArtifactPart)`                                                      |
| `question`       | 在选项提问片段中点选了一项                        | `(part: ChatQuestionPart, value: string \| number, option: ChatQuestionOption)` |
| `react`          | 点击了一项回应，或在 `reaction-picker` 里选了表情 | `(emoji: string, reaction: ChatMessageReaction \| undefined)`                   |

### Slots

| 名称              | 说明                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| `text`            | 渲染文字片段，参数为 `{ part, text, index, sources }`                       |
| `markdown-*`      | Markdown 组件的同名插槽，如 `markdown-code`、`markdown-link`                |
| `part`            | 渲染未知类型的片段，参数为 `{ part, index }`                                |
| `actions`         | 追加在内置操作后面的按钮                                                    |
| `trailing`        | 跟在最后一个文字片段末尾的内容，见[跟在文字后面的标记](#跟在文字后面的标记) |
| `reaction-picker` | “添加回应”弹出层的内容，参数为 `{ react, close }`；不提供时没有添加按钮     |
| `reaction`        | 渲染回应的表情，参数为 `{ reaction }`                                       |
| `default`         | 替换全部片段，自己排版                                                      |

### CSS 变量

| 变量                             | 说明                                                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--dou-chat-message-bubble`      | 用户消息气泡的底色                                                                                                                                                                                                                       |
| `--dou-chat-message-highlight`   | 高亮描边的颜色                                                                                                                                                                                                                           |
| `--dou-chat-message-toolbar-top` | 长消息滚动时浮条固定的位置：浮条高 30px，其中 24px 在消息上方，固定时它的上边缘离滚动区域顶部为这个值减 `24px`。默认 `28px`，即离顶部 4px。整页滚动、页面顶部有固定的导航栏时，在外层设置为导航栏高度加 `28px`，浮条就停在导航栏下方 4px |

### ChatMessageReaction

| 字段      | 说明                                       | 类型      |
| --------- | ------------------------------------------ | --------- |
| `emoji`   | 表情，或应用自己用来区分回应的标识         | `string`  |
| `count`   | 回应的人数，为 0 时不显示                  | `number`  |
| `reacted` | 自己也回应过，再点一次表示收回             | `boolean` |
| `label`   | 补充说明，比如回应的人，跟在表情和人数后面 | `string`  |
