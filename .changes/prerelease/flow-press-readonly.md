---
type: 不兼容
packages: [flow]
pr: 394
version: 0.1.0-alpha.10
---

扩展的 `press` 在 `readonly` 时也会被调用（白板的评论和移动画布工具要用）。自己写的 `press` 如果会修改文档，在开头判断 `ctx.readonly.value`，为 `true` 时直接返回。
