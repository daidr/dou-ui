---
type: 修复
packages: [dou-ui, flow]
---

`layoutGraph` 里从扇形最外侧绕过的长连线不再多偏出约半个节点宽：它只和最近的节点隔开一个 `laneGap`，扇形按其中的节点居中对称。NodeGraph 和流程编辑器的整理布局随之收窄，窄容器里不再被截掉一块。
