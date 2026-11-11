---
type: 新增
packages: [editor]
---

文档里的白板和流程图块可以评论：全屏编辑器里右键图形或连线、点工具栏按钮或按 `Ctrl/⌘+Alt+M` 发起讨论，也可以钉在图形里的某一点。讨论和文字上的共用 `v-model:comments`、作者和 `v-model:activeComment`，在评论列表里打开白板上的讨论会打开全屏编辑器并定位到图形。`getCommentAnchors()` 对这些讨论多返回 `type` 和 `target`。自定义块可以在 spec 里写 `comments` 接入同一套能力；`whiteboardBlock` 和 `flowBlock` 新增 `commentable` 选项。
