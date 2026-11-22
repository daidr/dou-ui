---
type: 修复
packages: [theme]
pr: 506
version: 0.1.0-alpha.22
---

`DouButton` 内部 `.dou-button__label` 补充 `min-width: 0`、`overflow-x: clip` 与 `text-overflow: ellipsis`，限制按钮宽度时默认插槽长文本与内部弹性子节点都能正常收缩并省略截断。
