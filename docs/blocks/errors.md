---
wide: true
---

# 错误页

404、403、500 三种错误页，以及网络断开时的提示。

<DocDemo src="blocks/errors" column />

用到的组件：[Result](../components/result)、[Empty](../components/empty)、[Button](../components/button)、[CopyButton](../components/copy-button)、[Toast](../components/toast)。

- 404 和 403 用 `icon` 插槽把图标换成状态码；500 用 `status="danger"`，并在 `extra` 插槽里放可以复制的错误编号，方便用户反馈问题。
- 网络断开不是一个独立页面，通常显示在内容区域里，所以用 Empty。重试时按钮显示加载状态，失败后用 Toast 提示。
- 每个页面都给出下一步可以做什么，而不只是说明出了错。
