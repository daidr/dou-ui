---
type: 修复
packages: [theme, dou-ui]
pr: 554
version: 0.1.0-alpha.29
---

修复 `DouSegmentedControl` 与 `DouCheckTag` 在窄容器中的截断省略与溢出问题：`DouSegmentedControl` 的 `.dou-segmented-control__label` 在纯文本选项下保持块级容器以正常显示单行省略号（自定义 `#option` 插槽包含图标等子元素时再切换为 `inline-flex` 并将伴随文本包裹进 `.dou-segmented-control__text` 保持省略），同时为轨道与 `.dou-segmented-control__item` 补充 `min-width: 0` 避免非 `block` 模式溢出轨道边界；`DouCheckTag` 的 `.dou-check-tag__label` 补充 `min-width: 0` 且 `.dou-check-tag-group` 补充 `min-width: 0` 与 `max-width: 100%`，使单标签超长时正常触发省略号且不撑破容器。
