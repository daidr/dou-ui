---
type: 改进
packages: [dou-ui, theme, editor]
pr: 539
version: 0.1.0-alpha.27
---

优化 `DouMarkdown` 表格在窄屏下的列宽约束与横向滚动体验，并将 `DouMarkdown` 与 `@dou-ui/editor` 表格的边缘横向溢出提示统一改用 CSS `mask-image` 渐隐（自适应浅色、深色、聊天气泡与提示块等任意背景）：`DouMarkdown` 新增可继承 CSS 变量 `--dou-markdown-table-col-min-width`（默认 `96px`）、`--dou-markdown-table-col-max-width`（默认 `min(320px, 70vw)`）与 `--dou-markdown-table-scroll-fade`（默认 `24px`），补充 `overscroll-behavior-x: contain` 并通过 `is-cut-start` / `is-cut-end` 控制边缘渐隐（兼容 SSR 与流式追加）；`@dou-ui/editor` 表格同步改用 `mask-image` 渐隐，并将 `--dou-editor-scroll-shadow` 替换为 `--dou-editor-scroll-fade`（默认 `24px`）。
