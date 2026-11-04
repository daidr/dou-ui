---
type: 新增
packages: [dou-ui, theme]
---

新增 Markdown 流式渲染组件 `DouMarkdown`：增量解析，已写完的块不再重新解析和渲染；写了一半的加粗、链接、表格、代码块直接以最终的样子显示；新内容逐步渐显，遵循减弱动态效果。不解析 HTML，链接只允许安全协议，支持服务端渲染。同时导出 `parseMarkdown` 和 `createMarkdownParser`。

ChatMessage 新增 `markdown`，文字片段用 Markdown 渲染，正文中的 `[1]` 显示为消息来源的角标。

CodeBlock 新增 `streaming`，代码逐步到达时只高亮完整的行，新行逐行淡入；使用 `createCodeHighlighter` 时代码块的语法颜色现在能正确显示。
