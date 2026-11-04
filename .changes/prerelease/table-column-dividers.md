---
type: 不兼容
packages: [dou-ui, theme]
pr: 301
version: 0.1.0-alpha.3
---

Table 原来画列分隔线的 `bordered` 改名为 `columnDividers`，`bordered` 现在和其他组件一样表示外框（默认开）。迁移：把 `<DouTable bordered>` 改成 `<DouTable column-dividers>`；对应的类名从 `is-bordered` 变为 `is-column-dividers`。
