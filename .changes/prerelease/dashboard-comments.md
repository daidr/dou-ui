---
type: 新增
packages: [dashboard]
pr: 352
version: 0.1.0-alpha.4
---

`DouDashboard` 支持评论：传入 `v-model:comments` 和 `author` 后，格子标题栏出现评论按钮，显示讨论条数，点击或按 `Ctrl/⌘` + `Alt` + `M` 发起、查看讨论。讨论 id 保存在格子的 `comments` 字段，内容在 `v-model:comments` 里；不能编辑时也能评论，`v-model:activeComment` 可与侧栏联动，`getCommentAnchors()` 查询每条讨论所在的格子。
