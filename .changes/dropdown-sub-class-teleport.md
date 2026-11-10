---
type: 修复
packages: [dou-ui]
---

`DouDropdownSub` 的子菜单面板现在带上 `DouDropdown`、`DouContextMenu` 上写的 `class`，并和外层菜单渲染到同一个地方（遵循 `teleport` 和全局配置），此前固定渲染到 `body`，在全屏元素里看不到。
