---
type: 新增
packages: [dou-ui, theme]
pr: 536
version: 0.1.0-alpha.26
---

`DouTabs` 与 `DouDock` 支持通过 `--dou-tabs-tab-max-width` 限制标签最大宽度并截断长标题，悬停时仅在标题实际溢出时自动展示原生 `title` 提示完整标题（含溢出列表弹层与自定义 `label` 插槽）；`DouDock` 新增面板 `mergeId`、`beforeMove` 回调、`move` 事件的 `mergedInto` 字段以及 `mergeDockTab` 布局函数，支持跨组拖动同源标签时高亮目标标签并在松手后自动合并激活。
