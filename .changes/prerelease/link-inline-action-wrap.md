---
type: 改进
packages: [dou-ui, theme]
pr: 506
version: 0.1.0-alpha.22
---

`DouLink` 的 `variant="soft"` 在无 `href` 时改为渲染带 `role="button"` 与键盘 Enter/Space 激活的行内元素，可随段落文本自然跨行折断且点击不误触外层 `<label>`；同时新增 `wrap` 属性，让 `variant="text"` 链接也能以同样方式跨行折断。
