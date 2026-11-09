---
type: 不兼容
packages: [flow]
---

`ports: 'sides'`（`sidePorts`）的端口改为和白板形状的锚点一样：起点在悬停或选中节点时显示，终点只在拉连线时显示。需要一直显示的，在组件里放 `<DouFlowPort visible="always">`，或者自己写端口列表。
