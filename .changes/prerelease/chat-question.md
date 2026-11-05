---
type: 新增
packages: [dou-ui, theme]
pr: 348
version: 0.1.0-alpha.4
---

新增 `DouChatQuestion` 选项提问：助手提一个问题，用户从几个选项里选一个回答。它有等待中、已回答、已撤回三种状态，回答或撤回后收起为一行，外观与 `DouChatConfirm` 一致。`DouChatMessage` 新增 `question` 片段和 `question` 事件。
