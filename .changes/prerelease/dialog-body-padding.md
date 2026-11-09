---
type: 修复
packages: [theme]
pr: 399
version: 0.1.0-alpha.11
---

DouDialog 没有标题栏（不传标题、`closable` 为 `false`、也没有 `fullscreenable`）时，正文四边都用 `--dou-dialog-padding`，不再在顶部多留 8px；有标题、关闭按钮或全屏按钮任一存在时显示标题栏，标题栏和正文之间仍是 8px。
