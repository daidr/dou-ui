---
type: 新增
packages: [dou-ui, theme]
pr: 507
version: 0.1.0-alpha.22
---

`DouCodeBlock` 新增 `maxHeight` 限高纵向滚动（无标题栏复制按钮自动吸顶并避让滚动条）与 `autoScroll` 自动贴底跟随（`streaming` 下默认开启，上滚暂停、回到底部恢复），并暴露 `body`、`atBottom`、`scrollToBottom()` 及 `atBottomChange` 事件。
