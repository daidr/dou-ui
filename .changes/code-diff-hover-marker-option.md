---
type: 新增
packages: [code]
---

DouCodeDiff 的 `CodeDiffGutter` 新增 `hoverMarker`：没有自己标记的每一行都显示这个标记，悬停时出现，可以用 `side` 只放在一侧，适合“每一行都能点 + 开始写评论”这样的入口，不用再为每一行写一个标记。`markers` 改为可选。
