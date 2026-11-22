---
type: 修复
packages: [dou-ui, theme, form-builder]
pr: 506
version: 0.1.0-alpha.22
---

`DouFormItem` 标签改为首行基线对齐并启用 `overflow-wrap: anywhere`，多行标签下必填星号与可选标记不再垂直居中偏移，超长无空格标签也会自动断行不撑破容器；水平与行内布局保持首行与控件垂直居中，在 `DouForm` 设置固定 `label-width` 时也支持多行折行。
