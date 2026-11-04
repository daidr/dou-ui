---
type: 不兼容
packages: [dou-ui, theme]
---

Descriptions 原来把列表画成表格的 `bordered` 改为 `variant: 'plain' | 'table'`（默认 `'plain'`），`bordered` 现在和其他组件一样只表示外框：`table` 样式默认带外框，设为 `false` 时去掉外框，单元格之间的细线保留。迁移：把 `<DouDescriptions bordered>` 改成 `<DouDescriptions variant="table">`；对应的类名从 `is-bordered` 变为 `dou-descriptions--table`。新增 `--dou-descriptions-border` 调整外框颜色。
