---
type: 不兼容
packages: [editor]
pr: 308
version: 0.1.0-alpha.3
---

块编辑器的间距拆成两个：`--dou-editor-block-gap` 改为相邻两块之间的距离（原来是每块上下各留的距离，默认值从 `2px` 改为 `4px`，看起来不变；原来自定义了它的，把值乘以 2），新增 `--dou-editor-list-gap` 控制同一列表里相邻两项的距离，调大块间距时列表不再跟着变松。新增 `--dou-editor-reading-width` 限制正文宽度，编辑器更宽时正文居中、手柄显示在左侧边距里。代码块上下的距离也改为跟着块间距走。
