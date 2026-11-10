---
type: 改进
packages: [editor]
pr: 412
version: 0.1.0-alpha.13
---

设置了 `--dou-editor-reading-width` 时，顶层的宽表格不再受正文宽度限制：左边和正文对齐，右边伸进正文右侧的空白；还放不下时左右滚动，左边先移到手柄栏边上，再滚动列。

表格左右滚动时，还有被遮住的列的一侧显示一道阴影，新增 `--dou-editor-scroll-shadow` 调整颜色。
