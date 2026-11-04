---
type: 修复
packages: [dou-ui, flow, form-builder]
pr: 299
version: 0.1.0-alpha.3
---

按需引入时，组件内部用到的其他组件也能读到 ConfigProvider `defaults` 里给它们的默认值，例如只引入 ChatMessage 时 `defaults.DouStreamText` 对消息里的文字同样生效；此前要先在别处引入过 StreamText 才有效。涉及 ChatMessage、Table、Pagination、ColorPicker、CommentThread、ContextMenu、白板的连接点、表单设计器的预览等所有嵌套使用其他组件的地方。
