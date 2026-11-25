---
type: 改进
packages: [dou-ui, theme]
---

优化 `DouMarkdown` 表格在窄屏下的列宽约束与横向滚动体验：表格在容器宽度不足时按内容自然展开并保留窄表撑满宽度，新增可继承 CSS 变量 `--dou-markdown-table-col-min-width`（默认 `96px`）、`--dou-markdown-table-col-max-width`（默认 `min(320px, 70vw)`）与 `--dou-markdown-table-scroll-shadow`，补充 `overscroll-behavior-x: contain` 横向滚动防穿透，并在水平溢出时通过 `is-cut-start` / `is-cut-end` 动态显示左右边缘滚动阴影提示（兼容 SSR 与流式追加）。
