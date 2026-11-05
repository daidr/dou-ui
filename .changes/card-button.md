---
type: 修复
packages: [dou-ui, theme]
---

`DouCard` 的 `as="button"` 不再带浏览器按钮的内边距、字体和居中，外观与其他卡片一致，自带悬停描边和焦点环，默认 `type="button"`；内部各部分改用 `span` 渲染，结构合法。
