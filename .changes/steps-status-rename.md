---
type: 不兼容
packages: [dou-ui, theme, flow, form-builder]
---

Steps、NodeGraph 和流程编辑器默认节点的状态改用和聊天套件（ChatPlan、ChatToolCall、ChatConfirm）相同的词：`wait` → `pending`、`process` → `running`、`finish` → `done`，`error`、`blocked` 不变。迁移：

- Steps：`status` 属性和 `items[].status` 里的旧值换成新值，`status` 的默认值随之变为 `running`；`title` / `description` 插槽里对 `status` 的判断改用新值；样式类 `.is-wait` / `.is-process` / `.is-finish` 换成 `.is-pending` / `.is-running` / `.is-done`；自定义语言包的 `steps.wait` / `steps.process` / `steps.finish` 换成 `steps.pending` / `steps.running` / `steps.done`。
- NodeGraph：节点的 `status` 换成新值（不填时默认 `pending`）；DouNodeGraphLegend 自定义 `items` 里 `{ type: 'status', value }` 的 `value` 换成新值；样式类同上；CSS 变量 `--dou-node-graph-status-wait` / `-process` / `-finish` 换成 `-pending` / `-running` / `-done`；自定义语言包的 `nodeGraph.status.wait` / `process` / `finish` 换成 `pending` / `running` / `done`。
- 流程编辑器默认节点：`data.status` 换成新值；样式类同上；CSS 变量 `--dou-flow-editor-status-wait` / `-process` / `-finish` 换成 `-pending` / `-running` / `-done`；自定义语言包的 `status.wait` / `process` / `finish` 换成 `pending` / `running` / `done`。未开始的状态点读作「未开始」，不再是「等待」。
