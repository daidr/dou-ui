---
type: 不兼容
packages: [dou-ui, theme]
pr: 296
version: 0.1.0-alpha.3
---

聊天套件的状态名统一为和 ChatPlan 相同的一套：`pending` 未开始、`running` 进行中、`waiting` 等待别人（比如等用户确认）、`done` 已完成、`error` 出错。

**先检查这一处，类型检查发现不了**：ChatToolCall 的 `pending` 仍然合法，但含义从“等待确认”变成了“未开始”。请搜索 `DouChatToolCall` 和 `type: 'tool'` 里的 `'pending'`，等待用户允许的调用改为 `'waiting'`。开发环境下，`pending` 的调用带 `actions` 插槽时会警告一次。

| 组件                                              | 原来                    | 现在                         |
| ------------------------------------------------- | ----------------------- | ---------------------------- |
| ChatToolCall                                      | `pending`（等待确认）   | `waiting`                    |
| ChatToolCall                                      | `success`（也是默认值） | `done`（默认值）             |
| ChatToolCall                                      | —                       | 新增 `pending`，表示还没开始 |
| ChatConfirm                                       | `pending`（也是默认值） | `waiting`（默认值）          |
| ChatArtifact                                      | `generating`            | `running`                    |
| ChatAttachments                                   | `uploading`、`success`  | `running`、`done`            |
| ChatMessage 的 `tool`、`confirm`、`artifact` part | 同上对应组件            | 同上对应组件                 |

- 样式类：`.dou-chat-tool-call--pending`、`--success` 改为 `--waiting`、`--done`；`.dou-chat-confirm.is-pending` 改为 `.is-waiting`；附件的 `.is-uploading`、`.is-success` 改为 `.is-running`、`.is-done`。
- 语言包：`chat.toolSuccess` 改名为 `chat.toolDone`，新增 `chat.toolWaiting`，`chat.toolPending` 现在是“未开始”的文案。
- 数据来自接口 JSON 等不经过类型检查的地方时，开发环境遇到不认识的 `status` 会警告一次，旧名字会提示对应的新名字。ChatConfirm 遇到不认识的值时不再显示为“已拒绝”。
