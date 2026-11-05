---
type: 新增
packages: [flow]
---

`DouFlowEditor` 新增评论：传入 `v-model:comments` 后可以对节点和连线发起讨论，讨论所在位置保存在节点和连线的 `comments` 字段，配合 `v-model:activeComment`、`commentAction` 事件和 `getCommentAnchors()` 做评论列表和保存。
