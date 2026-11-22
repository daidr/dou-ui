---
type: 修复
packages: [editor, flow]
---

`DouEditor` 与 `DouFlowEditor` 触发 `commentAction` 事件时，`getCommentAnchors()` 可在回调中同步读到新建或移除后的最新锚点，无需等待 `v-model` 回传或下一帧渲染。
