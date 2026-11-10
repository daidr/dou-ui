---
type: 新增
packages: [editor]
pr: 416
version: 0.1.0-alpha.13
---

块编辑器支持分栏：斜杠菜单里的“分栏”可以在旁边的面板里选择 2 到 5 栏（手机上在这一项下面展开）；块可以在栏之间拖动，拖到两栏之间新建一栏，拖动栏之间的竖线调整栏宽（也可以用键盘和触屏），区域窄于 480px 时各栏上下排列。分栏里不能再放分栏。斜杠菜单的选项新增 `choices`，可以在选项旁边选择变体，自己画变体时用 `BlockOptionChoicesProps` 和 `BlockOptionChoicesEmits`。`checkDocument` 新增 `invalid-columns`，扩展的 `context` 新增 `messages()`。
