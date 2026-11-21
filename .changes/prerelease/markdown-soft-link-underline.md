---
type: 修复
packages: [theme]
pr: 466
version: 0.1.0-alpha.21
---

DouMarkdown 不再覆盖插槽中 DouLink 等组件的链接样式，并移除 DouLink 文字标签上重复继承的下划线：在 DouMarkdown 内渲染 soft 变体的 DouLink 时默认保持无下划线，显式开启下划线时整段文字颜色深浅一致。
