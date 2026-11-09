---
type: 新增
packages: [flow]
---

端口新增显示时机 `visible`：写在端口声明（`FlowPortSpec`）或 `DouFlowPort` 上，`hover` 在悬停、选中节点或节点里有焦点时显示，`connecting` 只在拉连线时显示，只读时都不显示。自定义白板节点用 `ports: 'sides'` 就和内置形状有一样的锚点，缩放时大小也一样。
