---
type: 不兼容
packages: [dou-ui, theme]
---

DouChatContextMeter 收窄为纯圆环：去掉内置的提示和 `tabindex`，移除 `format`，根元素也不再有内边距和固定高度。提示和用量明细由应用用 DouTooltip、DouPopover 自己组合，通常把圆环放进 ghost 按钮里，写法见文档。新增从 `dou-ui` 导出的 `compactNumber` 和 `contextUsage`，写提示时可以得到和圆环一致的数字；`used`、`total` 为负数或不是有限数时按 0 处理。

迁移：想保留原来的悬停提示，先用 `const u = contextUsage(used, total)` 算出用量，再把圆环包进 `<DouTooltip :content="t('chat.context', { used: compactNumber(u.used), total: compactNumber(u.total), percent: u.percent })">` 并加上 `tabindex="0"`；需要点击打开明细时，把圆环放进按钮。
