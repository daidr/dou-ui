---
type: 不兼容
packages: [dou-ui]
---

ChatSteps 表示“是否还在进行”的 `running` 属性改名为 `live`，与 ChatPlan、ChatToolCall 一致；`title` 插槽的参数 `running` 也改为 `live`，ChatMessage 的 `steps` 片段同样改用 `live` 字段。请把 `:running="…"`、`{ type: 'steps', running }` 和插槽里的 `running` 改为 `live`。为 `false` 时，`running` 的步骤现在会换成静止的主色圆点。
