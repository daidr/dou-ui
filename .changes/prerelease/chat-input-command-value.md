---
type: 不兼容
packages: [dou-ui]
pr: 341
version: 0.1.0-alpha.4
---

`DouChatInput` 的命令有 `label` 时不再按 `value` 匹配：`value` 用户看不到，常常只是 id。以前靠 `value` 找到的命令（如输入 `/sum` 找到 `{ value: 'summarize', label: '总结' }`），把这个词写进 `keywords`：`{ value: 'summarize', label: '总结', keywords: ['summarize'] }`。
