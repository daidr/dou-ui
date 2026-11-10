---
type: 新增
packages: [editor]
pr: 429
version: 0.1.0-alpha.15
---

块的 spec 新增 `checkProps`，`checkDocument` 用它把块类型不能使用的属性报告为 `invalid-props`；白板会报告不是流程文档的 `board` 和不是正数的 `height`。
