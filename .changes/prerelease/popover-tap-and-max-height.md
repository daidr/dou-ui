---
type: 新增
packages: [dou-ui, theme]
pr: 504
version: 0.1.0-alpha.22
---

`DouPopover` 新增 `openOnTap` 属性，支持在 `hover` 触发模式下关闭触屏或触控笔轻点弹出，避免遮挡触发元素自身的主动作；同时默认按视口可用高度（`--dou-floating-available`）限制最大高度并使内容区内部纵向滚动，支持通过 `maxHeight` 属性或 `--dou-popover-max-height` 自定义高度上限，并修正侧向定位时的可用垂直高度计算。
