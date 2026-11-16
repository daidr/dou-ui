---
type: 修复
packages: [editor]
---

白板和流程图块中缺少端点、端点格式不对或引用不存在节点的连线会被忽略，不再导致整块空白；`checkDocument` 会报告这些连线。
