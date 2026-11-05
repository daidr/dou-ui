---
type: 新增
packages: [flow]
pr: 351
version: 0.1.0-alpha.4
---

`DouFlowEditor` 新增评论：传入 `v-model:comments` 后可以对节点和连线发起讨论，讨论所在位置保存在节点和连线的 `comments` 字段，配合 `v-model:activeComment`、`commentAction` 事件和 `getCommentAnchors()` 做评论列表和保存。只读时选中节点或连线，工具栏上只显示评论按钮；工具栏按钮新增 `showWhenReadonly` 字段，写上的按钮只读时也显示。
