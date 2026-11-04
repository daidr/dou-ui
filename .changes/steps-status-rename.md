---
type: 不兼容
packages: [dou-ui, theme, form-builder]
---

Steps 的状态改名，和聊天套件（ChatPlan、ChatToolCall、ChatConfirm）用同一套词：`wait` → `pending`、`process` → `running`、`finish` → `done`，`error` 不变。迁移：`status` 属性、`items[].status` 和插槽参数里的旧值换成新值，`status` 的默认值随之变为 `running`；样式里的 `.is-wait` / `.is-process` / `.is-finish` 换成 `.is-pending` / `.is-running` / `.is-done`；自定义语言包里 `steps.wait` / `steps.process` / `steps.finish` 换成 `steps.pending` / `steps.running` / `steps.done`。
