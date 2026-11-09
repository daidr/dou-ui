---
type: 改进
packages: [editor]
---

`markdownToBlocks` 新增 `domParser` 选项，在 Node、Bun 等没有 `DOMParser` 的地方传入 happy-dom、linkedom 等 DOM 库的实现，就能把 Markdown 读成块；读 HTML 时不再用到 `Element`、`Text`、`NodeFilter` 这些全局对象。
