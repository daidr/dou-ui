---
type: 改进
packages: [dou-ui, theme]
pr: 524
version: 0.1.0-alpha.24
---

优化 `DouChatInput` 的 `/` 命令与 `@` 提及补全菜单排版：`commands` 选项带 `description` 时改为清晰的双行堆叠布局（无描述项保持紧凑单行垂直居中），`mentions` 选项统一为单行对齐布局（左侧固定图标、中间 `@label` 单行省略、右侧 `description` 靠右对齐并在最大宽度内单行截断）；菜单桌面端默认最大宽度放宽至 `440px` 并暴露 `--dou-chat-input-menu-max-width` 变量，同时不再对 `#option` 自定义插槽中的描述施加 `max-width: 40%` 限制。
