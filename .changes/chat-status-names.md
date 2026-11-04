---
type: 不兼容
packages: [dou-ui, theme]
---

聊天套件的状态名统一为和 ChatPlan 相同的 `pending`（未开始）、`running`（进行中）、`waiting`（等待别人）、`done`（已完成）、`error`（出错），迁移时按下面改名：ChatToolCall 原来表示等待用户允许的 `pending` 改为 `waiting`，`success` 改为 `done`（默认值也随之变为 `done`），新的 `pending` 表示还没开始；ChatConfirm 的 `pending` 改为 `waiting`（默认值同样改变）；ChatArtifact 的 `generating` 改为 `running`；ChatAttachments 附件的 `uploading` 改为 `running`、`success` 改为 `done`。消息 `parts` 里 `tool`、`confirm`、`artifact` 的 `status` 同样改名。样式类随之变化：`.dou-chat-tool-call--pending` 改为 `--waiting`，`--success` 改为 `--done`，`.dou-chat-confirm.is-pending` 改为 `.is-waiting`，附件的 `.is-uploading`、`.is-success` 改为 `.is-running`、`.is-done`。自定义语言包里的 `chat.toolSuccess` 改名为 `chat.toolDone`，并新增 `chat.toolWaiting`，`chat.toolPending` 现在是“未开始”的文案。
