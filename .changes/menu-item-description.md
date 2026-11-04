---
type: 新增
packages: [dou-ui, theme]
---

DropdownItem 新增 `description` 属性和插槽，在名字下面显示一行说明，Dropdown、ContextMenu 的 `items`（`ContextMenuItem.description`）同样可用。说明字号更小、颜色更浅，可以换行但不会单独撑宽菜单；图标、勾选标记和快捷键与名字对齐。读屏软件以名字作为名称、说明作为描述，按字母跳转只匹配名字。
