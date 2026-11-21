---
type: 修复
packages: [dou-ui, theme]
pr: 461
version: 0.1.0-alpha.20
---

修复 Popover 靠近视口边缘时，内容更新导致面板逐帧变宽的问题；浮层尺寸变化后在绘制前更新定位，避免短暂越出视口。
