---
type: 新增
packages: [editor, flow]
pr: 391
version: 0.1.0-alpha.10
---

没有编辑器也能改正在协同编辑的文档，适合把文档交给 AI 改写后写回：`@dou-ui/editor/collaboration` 新增 `updateMap(map, doc, { base, extensions, origin })`，`@dou-ui/flow/collaboration` 新增 `readMaps` 和 `updateMaps(maps, doc, { base, origin })`。传入程序读到的那一份作为 `base`，只把 `base` 到新版本之间的差别写进共享文档，这期间其他人的输入、新加的块和节点都保留；块保留 id、文字按字符改，从 Markdown 读出的块按内容和文字相似度对应到原来的块，文字没变的地方评论也留着。`fillMaps` 也可以传 `origin`。
