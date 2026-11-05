# AI 对话

一组用来搭建 AI 对话界面的组件。一条回复由多个片段组成：执行步骤、任务计划、思考过程、工具调用、正文、引用来源、产物和操作确认，用 [ChatMessage](./chat-message) 按片段数组渲染；输入框支持 `/` 命令、`@` 引用和生成中继续输入。

组件只负责界面。请求模型、解析流式响应、保存对话记录都由你自己的代码完成，组件通过 props、`v-model` 和事件拿到状态。

## 完整示例

下面是一个带侧边面板的对话窗口。第一轮对话展示了各种片段：点击“已完成 4 个步骤”展开执行过程，悬停正文里的角标预览来源，点击产物卡片在右侧打开，确认卡片可以允许或拒绝。

在输入框里输入 `/` 或 `@` 试试菜单；发送后，示例用定时器模拟一次回答：先显示等待圆点，再逐步执行搜索，最后逐字输出正文，生成中可以停止，也可以继续输入。

<DocDemo src="chat/overview" column />

## 欢迎页

对话还没开始时，可以用 [ChatSuggestions](./chat-suggestions) 给出几个常用的起点，点击后填进输入框。

<DocDemo src="chat/welcome" column />

## 组件一览

| 组件                                     | 用途                                               |
| ---------------------------------------- | -------------------------------------------------- |
| [ChatMessage](./chat-message)            | 一条消息，按片段渲染，带复制、编辑、版本切换       |
| [ChatList](./chat-list)                  | 消息的滚动容器，新内容到达时自动滚动到底部         |
| [ChatInput](./chat-input)                | 输入框，`/` 命令、`@` 引用、生成中可停止或继续输入 |
| [StreamText](./stream-text)              | 平滑显示逐步到达的文字                             |
| [Markdown](./markdown)                   | 渲染 Markdown，支持流式输出                        |
| [ChatSteps](./chat-steps)                | 折叠为一行的执行步骤                               |
| [ChatPlan](./chat-plan)                  | 任务计划清单                                       |
| [ChatReasoning](./chat-reasoning)        | 可折叠的思考过程                                   |
| [ChatToolCall](./chat-tool-call)         | 一次工具调用的状态、参数和结果                     |
| [ChatSources](./chat-sources)            | 引用来源与正文角标                                 |
| [ChatArtifact](./chat-artifact)          | 生成的文档、代码等产物                             |
| [ChatConfirm](./chat-confirm)            | 执行操作前的确认                                   |
| [ChatQuestion](./chat-question)          | 请用户从几个选项里选一个回答                       |
| [ChatSuggestions](./chat-suggestions)    | 可点击的提示建议                                   |
| [ChatAttachments](./chat-attachments)    | 消息附带的文件                                     |
| [ChatContextMeter](./chat-context-meter) | 上下文用量                                         |
| [Shimmer](./shimmer)                     | 带扫光效果的状态文字                               |
| [ChatBubble](./chat-bubble)              | 带头像和名字的气泡，适合人与人的聊天               |

## 接入流式响应

以常见的流式接口为例，每收到一段文字就追加到文字片段上，新增的部分会被平滑显示出来。用户发送新消息时，可以调用 ChatList 的 `scrollToBottom()` 回到底部：

```js
async function ask(question) {
  const part = reactive({ type: 'text', text: '', streaming: true })
  messages.value.push({ sender: 'assistant', parts: [part] })

  controller = new AbortController()
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ question }),
    signal: controller.signal,
  })
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      part.text += value
    }
  } finally {
    part.streaming = false
  }
}

// ChatInput 的 stop 事件
function stop() {
  controller?.abort()
}
```
