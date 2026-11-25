---
type: 修复
packages: [theme]
---

`DouText` 的 `.dou-text.is-truncate` 补充 `min-width: 0`（保持 `overflow-x: clip` 不裁切垂直字形），修复作为水平 Flex 或 Grid 子项与按钮、图标并排时在窄容器内无法收缩、溢出父容器并遮挡相邻元素的问题。
