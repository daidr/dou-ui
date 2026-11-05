---
type: 修复
packages: [code]
---

DouCodeDiff：只在悬停时显示的 gutter 标记（`visible: 'hover'`）不再阻止未改动的行收起。之前给每一行都放一个悬停标记后，`collapseUnchanged` 就不再收起任何行。
