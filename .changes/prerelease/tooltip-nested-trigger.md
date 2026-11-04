---
type: 修复
packages: [dou-ui]
pr: 314
version: 0.1.0-alpha.3
---

`DouTooltip` 套在 `DouPopover`、`DouDropdown`、`DouPopconfirm`、`DouContextMenu` 外面（或反过来）时，两层的属性与事件都落到同一个触发元素上，点击不再失效，也不再需要额外包一层 `<span>`。弹出层打开后提示自动收起。提示文字与触发元素的 `aria-label` 相同时不再设置 `aria-describedby`，读屏不会把同一句话读两遍。
