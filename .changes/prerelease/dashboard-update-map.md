---
type: 新增
packages: [dashboard]
pr: 418
version: 0.1.0-alpha.13
---

`@dou-ui/dashboard/collaboration` 新增 `updateMap(map, next, { base, origin })`：不经过仪表盘把新版本写进共享文档，只写 `base` 到新版本之间的差别（增删格子、改了的键、改了位置的断点、挪了顺序的格子），其他人同时做的修改保留。`fillMap` 也可以传 `origin`。
