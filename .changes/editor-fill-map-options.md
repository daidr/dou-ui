---
type: 不兼容
packages: [editor]
---

`@dou-ui/editor/collaboration` 的 `fillMap` 和 `readMap` 改为用选项传扩展，和 `updateMap` 一致：`fillMap(map, doc, extensions)` 改成 `fillMap(map, doc, { extensions })`，`readMap(map, extensions)` 改成 `readMap(map, { extensions })`。`fillMap` 还可以传 `origin`。
