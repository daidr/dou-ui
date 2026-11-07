---
type: 不兼容
packages: [dou-ui]
pr: 382
version: 0.1.0-alpha.9
---

DouDock 的 `move`、`split` 事件里 `from` 可能为 `null`，表示从 Dock 外拖进来、新开的标签（类型 `DockLocation | null`）。读 `from.group`、`from.index` 的地方改成先判断，如 `event.from?.group`。
