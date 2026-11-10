---
type: 修复
packages: [theme]
pr: 426
version: 0.1.0-alpha.14
---

DouTooltip 的 `content` 插槽里的 DouLink 跟随提示的文字色（`tone` 不生效），浅色主题下不再是深色字落在深色底上，下划线和外链箭头也一样；`soft` 链接的底色由提示的文字色混出。DouBanner 的 `solid` 横幅里，`soft` 链接在中性横幅上同样改用由文字色混出的底色，在彩色横幅上改为带下划线的普通样式，不再是浅灰底上的浅色字。
