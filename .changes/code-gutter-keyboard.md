---
type: 改进
packages: [code]
---

`DouCodeEditor` 有 `onPress` 的行号栏列里，标记成为带名称的按钮：光标所在行的标记可以按 Esc 后 Shift+Tab 聚焦，按 Enter 或空格触发 `onPress`，第二个参数可能是 `KeyboardEvent`。标记新增 `reveal: 'hover'`，平时不显示，指着这一行、光标在这一行或它有焦点时显示。修复按 Esc 后按 Shift+Tab 不能离开编辑区的问题。
