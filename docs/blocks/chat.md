---
wide: true
---

# AI 对话页

完整的对话页面：左侧是对话记录，可以新建、重命名和删除；右侧是消息列表和输入框，回复以流式输出显示。新对话先显示欢迎语和建议。

<DocDemo src="blocks/chat" column />

用到的组件：[ChatList](../components/chat-list)、[ChatMessage](../components/chat-message)、[ChatInput](../components/chat-input)、[ChatSuggestions](../components/chat-suggestions)、[Dropdown](../components/dropdown)、[Drawer](../components/drawer)、[Dialog](../components/dialog)。

- 回复是模拟的：先显示等待状态，再逐字写入 `text` 部分，写完把 `streaming` 设为 `false`。点击输入框的停止按钮会立即结束。
- 发送新消息时调用 `ChatList` 的 `scrollToBottom()`，回到最新的消息。
- 已经有空白对话时，“新对话”直接切换过去，不再新建。
- 页面宽度小于 640px 时，对话记录收进左侧抽屉，由标题栏的按钮打开。这里用的是容器查询，所以按页面本身的宽度判断，而不是按窗口宽度。
