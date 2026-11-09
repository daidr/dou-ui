---
type: 新增
packages: [editor]
---

`@dou-ui/editor/collaboration` 新增 `cursorAt(map, head, { anchor, extensions })`：不经过编辑器，按块 id 和块内文字位置得到放进 awareness `editor` 字段的光标，服务器上写入文档的一方也能显示自己的光标和名字。同时导出 `EditorPresence`、`EditorPresencePlace`、`EditorCursorTarget` 类型，文档写明 `editor` 字段的结构。
