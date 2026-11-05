---
type: 新增
packages: [dou-ui]
---

`DouChatInput` 的命令和引用按用户看得到的文字匹配：`label`（没有时用 `value`）、引用的 `value` 和 `description`，选项新增 `keywords` 补充匹配词；新增 `filter`，可传函数自定义匹配、`false` 原样列出，也可以按触发符分开设置，如 `{ '@': false }`；新增 `search` 事件和 `searchDelay`，`/`、`@` 后的文字变化时触发，方便按输入去服务端查候选。
