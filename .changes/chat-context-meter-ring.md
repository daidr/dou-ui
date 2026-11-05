---
type: 不兼容
packages: [dou-ui, theme]
---

DouChatContextMeter 收窄为纯圆环：去掉内置的提示和 `tabindex`，移除 `format`，根元素也不再有内边距和固定高度。提示和用量明细由应用用 DouTooltip、DouPopover 自己组合，通常把圆环放进 ghost 按钮里，写法见文档。`compactNumber` 现在从 `dou-ui` 导出，写提示时可以复用同样的数字格式。

迁移：想保留原来的悬停提示，把圆环包进 `<DouTooltip :content="t('chat.context', { used: compactNumber(used), total: compactNumber(total), percent })">`，再加上 `tabindex="0"`，或者把它放进按钮。
