---
type: 修复
packages: [dou-ui]
---

ChatSources 和 ChatCitation 只把 http(s)、mailto、tel 和相对地址渲染成链接，`javascript:`、`data:` 这类地址不再可以点击，开发环境下会警告一次。
