---
type: 新增
packages: [dou-ui]
---

ChatPlan、ChatToolCall 新增 `live` 开关，默认 `true`。这一轮结束或被停止时设为 `false`：`running` 的步骤或调用仍是当前这一项，但转圈换成静止的灰色圆点、去掉扫光，不用再逐个改写状态。ChatMessage 的 `plan`、`tool` 片段也可以带 `live`。
