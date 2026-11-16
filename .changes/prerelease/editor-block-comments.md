---
type: 新增
packages: [editor, flow]
pr: 451
version: 0.1.0-alpha.18
---

文档里的白板和流程图块可以评论：全屏编辑器里右键图形或连线、点工具栏按钮或按 `Ctrl/⌘+Alt+M` 发起讨论，也可以钉在图形里的某一点。讨论和文字上的共用 `v-model:comments`、作者和 `v-model:activeComment`；在评论列表里打开白板上的讨论，或点白板预览上的讨论标记，会打开全屏编辑器并定位到图形。`getCommentAnchors()` 对这些讨论多返回 `type` 和 `target`。自定义块可以给 `defineBlock` 传 `comments` 接入同一套能力，块组件的 `updateProps` 新增 `{ history: false }`，修改不进撤销记录；`whiteboardBlock` 和 `flowBlock` 新增 `commentable` 选项。流程编辑器在窄屏上打开讨论时，卡片不再盖住被评论的图形。
