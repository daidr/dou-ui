---
type: 新增
packages: [code]
pr: 349
version: 0.1.0-alpha.4
---

`DouCodeDiff` 新增 `gutters` 和 `widgets`：标记和行间小部件可以放在原文或修改后任一侧的行上，并排和 `inline` 两种视图都会放到对应的行；并排时另一侧留出同样高的空白保持对齐，`span: 'both'` 的小部件横跨两栏。带标记或小部件的行不会被收起。
