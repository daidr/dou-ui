---
type: 新增
packages: [flow]
---

Flow 的评论可以钉在节点里的一点上：`comment({ node, at: { x, y } })` 在那一点发起讨论（`x`、`y` 是节点宽高的 0–1 比例），每条钉住的讨论在那一点有一个带序号的钉子，随节点移动、缩放和旋转；位置保存在节点的 `commentPins` 里，`getCommentAnchors()` 返回的锚点带上 `at`。白板加了评论工具（M），点在节点上就在那一点发起讨论；`readonly` 时白板工具栏只留选择、移动画布和评论。
