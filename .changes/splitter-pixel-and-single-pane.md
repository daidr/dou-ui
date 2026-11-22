---
type: 新增
packages: [dou-ui, theme]
---

`DouSplitter` 新增 `unit`（`'percent' | 'px'`）与 `singlePane`（`'start' | 'end' | null`）：像素模式下在容器缩放时自动维持面板像素尺寸并扣除 1px 分隔线宽度；单栏模式下隐藏分隔条与非活跃面板同时保持双栏挂载，活跃面板占满整个容器。
