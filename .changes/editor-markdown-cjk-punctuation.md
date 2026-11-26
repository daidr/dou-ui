---
type: 修复
packages: [editor]
---

`@dou-ui/editor/markdown` 的默认 `markdown-it` 解析器原生支持 CJK 友好的强调（`*` / `**` / `_`）与删除线（`~~`）定界符规则，`blocksToMarkdown` 在 CJK 字符及标点边界同步放宽为输出纯 Markdown 语法（非 CJK 场景维持 CommonMark 兼容与 HTML 标签回退），修复中文标点紧贴加粗、斜体、删除线时解析错配及与 `DouMarkdown` 往返不一致的问题。
