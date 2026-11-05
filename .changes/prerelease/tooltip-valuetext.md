---
type: 改进
packages: [dou-ui]
pr: 357
version: 0.1.0-alpha.5
---

DouTooltip 的提示和触发器的 `aria-valuetext` 相同时（比如包着进度、上下文用量这类读出数值的元素），不再挂 `aria-describedby`，读屏不会把同一句话读两遍。
