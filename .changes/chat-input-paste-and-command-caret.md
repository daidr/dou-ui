---
type: 修复
packages: [dou-ui]
---

`DouChatInput` 粘贴文件时优先读取 `clipboardData.items`，未提取到文件时自动回退读取 `clipboardData.files` 并统一触发 `attach`；选择 `/` 命令后不再用旧光标位置覆盖父组件在 `command` 回调里修改 `v-model` 或在 `nextTick` 中设置的选区与焦点。
