---
type: 修复
packages: [code]
pr: 525
version: 0.1.0-alpha.24
---

修复 `DouCodeEditor` 与 `DouCodeDiff` 横向滚动时折叠未变更行横条及块级小部件左右抖动的问题，改用纯 CSS `position: sticky` 固定水平位置，并让折叠横条与对齐占位块横跨包含行号列在内的整行宽度；同时修复 `DouCodeDiff` 横向滚动时跨栏小部件短暂隐藏的问题。
