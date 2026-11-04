---
type: 修复
packages: [dou-ui, flow]
---

`layoutGraph` 里从扇形最外侧绕过的长连线不再多偏出约半个节点宽：它只和最近的节点隔开一个 `laneGap`，扇形按其中的节点居中对称。扇形外侧有长连线经过的 NodeGraph 和流程编辑器整理布局因此变窄，不会比原来更宽。
