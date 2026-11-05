---
type: 不兼容
packages: [dou-ui]
pr: 350
version: 0.1.0-alpha.4
---

移除 `setDialogContext` 和 `setToastContext`，改用 `setInstalledAppContext`：对话框、轻提示和其他在组件树之外渲染的内容共用同一个应用上下文。
