---
type: 新增
packages: [flow]
pr: 350
version: 0.1.0-alpha.4
---

新增 `renderFlowSVG(document, options?)` 和 `renderFlowPNG(document, options?)`：页面上不需要有编辑器，直接把文档画成和 `exportSVG`、`exportPNG` 一样的图片，可以用 `colorMode` 指定浅色或深色，默认沿用调用过 `app.use(DouUI)` 的应用的语言包，适合做缩略图。
