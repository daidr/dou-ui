---
type: 新增
packages: [dou-ui]
---

DouSplitter 新增 `minEnd`，限制第二个面板的最小尺寸，支持像素。像素限制在容器大小变化时也会保持，嵌套的 Splitter 会把自己的像素限制算进外层；容器放不下两边的最小尺寸时，按比例分配。
