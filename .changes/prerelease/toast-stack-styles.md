---
type: 不兼容
packages: [dou-ui, theme]
pr: 402
version: 0.1.0-alpha.11
---

轻提示的内容包进了新的 `.dou-toast__body`，内边距和横向排列都在它上面；`.dou-toast__item` 改为绝对定位，高度由组件按内容计算并控制，超出部分会被裁掉。原来写在 `.dou-toast__item` 上的内边距、`gap`、对齐等样式请改到 `.dou-toast__body`；`.dou-toast__item` 上只保留外壳样式（边框、背景、圆角、阴影），不要再设置 `height`、`position` 或 `transform`。
