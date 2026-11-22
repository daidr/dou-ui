---
type: 修复
packages: [theme]
pr: 503
version: 0.1.0-alpha.22
---

修复 `DouSplitter` 折叠态及拖拽、禁用、方向手柄等样式使用后代选择器的问题，改为直接子选择器，避免外层折叠或状态变化时误影响嵌套子分栏的面板与分隔条。
