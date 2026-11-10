---
type: 新增
packages: [flow]
pr: 429
version: 0.1.0-alpha.15
---

扩展的 `history` 新增可选的 `drop(group)` 与 `close()`：拖动被 `Esc` 取消、手势结束时调用，自定义撤销记录可以丢掉取消的拖动，把一次拖动合成一步。
