---
type: 改进
packages: [code]
---

`DouCodeEditor` 有 `onPress` 的行号栏列里，标记成为以 `title` 命名的按钮（这时 `title` 必填）：光标所在行的标记可以按 `Esc` 后 `Shift` + `Tab` 聚焦，按 `Enter` 或 `Space` 触发 `onPress`，第二个参数可能是 `KeyboardEvent`。标记新增 `visible: 'hover'`，平时不显示，指着这一行、光标在这一行或它有焦点时显示。修复按 `Esc` 后按 `Shift` + `Tab` 不能离开编辑区的问题。
