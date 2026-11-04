---
type: 新增
packages: [theme]
---

每种语气色新增浅色底 `soft`（`--dou-color-primary-soft`、`--dou-color-warning-soft` 等），亮色和暗色主题各一套，等于语气色以 7% 混进表面色，和 soft 按钮、标签的底色一致，语气文字和正文在上面都不低于 4.5:1。`createTheme` / `createTone` 会一并生成；手写完整 `ThemeTokens` 的主题需要给每种语气补上 `soft`。
