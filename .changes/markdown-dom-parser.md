---
type: 改进
packages: [editor]
---

`markdownToBlocks` 和 `htmlToBlocks` 新增 `domParser` 选项（类型 `DOMParserLike`），在 Node、Bun 等没有 `DOMParser` 的地方传入 happy-dom、linkedom 等 DOM 库的实现，就能读出块；读 HTML 时不再用到 `Element`、`Text`、`NodeFilter` 这些全局对象。
