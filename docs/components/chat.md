# AI 对话

一组用来搭建 AI 对话界面的组件：消息气泡、消息列表、输入框、流式文字、思考过程、工具调用、提示建议、附件和微光文字。

组件只负责界面。请求模型、解析流式响应、保存对话记录都由你自己的代码完成，组件通过 props、`v-model` 和事件拿到状态。

## 完整示例

下面把几个组件组合成一个对话窗口。发送消息后，示例用定时器模拟模型的回复过程：先显示加载中，再显示思考过程，最后逐字输出回答；生成期间可以点击停止。

<DocDemo src="chat/overview" column />

## 欢迎页

对话还没开始时，可以用 [ChatSuggestions](./chat-suggestions) 给出几个常用的起点，点击后填进输入框。

<DocDemo src="chat/welcome" column />

## 组件一览

| 组件                                  | 用途                                         |
| ------------------------------------- | -------------------------------------------- |
| [ChatBubble](./chat-bubble)           | 一条消息，带头像、名字、时间和底部操作       |
| [ChatList](./chat-list)               | 消息的滚动容器，新内容到达时自动贴底         |
| [ChatInput](./chat-input)             | 输入框，回车发送，生成期间可停止，可接收文件 |
| [StreamText](./stream-text)           | 平滑显示逐步到达的文字                       |
| [ChatReasoning](./chat-reasoning)     | 可折叠的思考过程                             |
| [ChatToolCall](./chat-tool-call)      | 一次工具调用的状态、参数和结果               |
| [ChatSuggestions](./chat-suggestions) | 可点击的提示建议                             |
| [ChatAttachments](./chat-attachments) | 消息附带的文件                               |
| [Shimmer](./shimmer)                  | 带扫光效果的状态文字                         |

## 接入流式响应

以常见的流式接口为例，每收到一段文字就追加到消息上，`StreamText` 会把新增的部分平滑显示出来：

```js
async function ask(question) {
  const reply = reactive({ text: '', streaming: true })
  messages.value.push(reply)

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
      reply.text += value
    }
  } finally {
    reply.streaming = false
  }
}

// ChatInput 的 stop 事件
function stop() {
  controller?.abort()
}
```
