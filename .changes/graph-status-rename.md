---
type: 不兼容
packages: [dou-ui, theme, flow]
---

NodeGraph 节点和流程编辑器默认节点的状态也改用 `pending` / `running` / `done`，与 Steps、聊天套件一致，`error`、`blocked` 不变。迁移：节点数据里的 `status: 'wait' | 'process' | 'finish'` 换成 `'pending' | 'running' | 'done'`（NodeGraph 不填时默认 `pending`）；样式类 `.is-wait` / `.is-process` / `.is-finish` 换成 `.is-pending` / `.is-running` / `.is-done`；CSS 变量 `--dou-node-graph-status-wait/process/finish` 和 `--dou-flow-editor-status-wait/process/finish` 换成对应的 `-pending/-running/-done`；流程编辑器自定义语言包里 `status.wait/process/finish` 换成 `status.pending/running/done`。
