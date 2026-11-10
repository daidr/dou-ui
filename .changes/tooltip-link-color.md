---
type: 修复
packages: [theme]
---

DouTooltip 的 `content` 插槽里的 DouLink 跟随提示的文字色，浅色主题下不再是深色字落在深色底上，下划线和外链箭头也一样；`soft` 链接的底色由提示的文字色混出。DouBanner 的 `solid` 横幅里的 `soft` 链接同样改用由横幅文字色混出的底色，不再是浅色底上的浅色字。
