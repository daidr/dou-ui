---
type: 修复
packages: [dou-ui]
pr: 535
version: 0.1.0-alpha.26
---

修复 `DouPopover` 传入超过 360px 的 `width` 时被默认 `--dou-popover-max-width: 360px` 截断的问题：显式传入 `width` 时同步更新 `--dou-popover-max-width`，同时保留视口宽度上限约束，窄屏下仍自动收缩不溢出。
