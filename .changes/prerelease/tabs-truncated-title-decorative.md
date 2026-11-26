---
type: 修复
packages: [dou-ui]
pr: 545
version: 0.1.0-alpha.28
---

修复 `DouTabs` 与 `DouDock` 在自定义 `#label` 插槽包含带波纹动画的 `DouStatusDot` 等无文本装饰节点时，未截断标签被误判溢出并错误展示原生 `title` 提示，以及前置装饰节点遮蔽后续截断文本检测的问题。
