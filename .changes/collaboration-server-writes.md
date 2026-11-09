---
type: 新增
packages: [editor, flow]
---

没有编辑器也能改正在协同编辑的文档：`@dou-ui/editor/collaboration` 新增 `updateMap`，把共享文档改成给定的文档，只写有差别的块和文字，id 对不上的块（比如从 Markdown 读出来的）按内容和位置对应；`@dou-ui/flow/collaboration` 新增 `readMaps` 读出流程、`updateMaps` 只写有变化的字段。两边都可以传 `origin`，适合在服务器上把别处写的新版本合进正在编辑的文档。
