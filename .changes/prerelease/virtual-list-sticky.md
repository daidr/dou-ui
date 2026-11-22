---
type: 修复
packages: [dou-ui, theme]
pr: 478
version: 0.1.0-alpha.22
---

`DouVirtualList` 可见项改为正常文档流配合顶部和底部占位高度排版，并为滚动容器补充 `overflow-anchor: none`，列表项内部元素现在可以原生使用 `position: sticky` 吸顶；`DouChatList` 虚拟模式下长消息的操作浮条也随之恢复吸顶跟随。
