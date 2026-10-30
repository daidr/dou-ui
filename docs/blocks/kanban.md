---
wide: true
---

# 看板

按状态分列的任务看板：卡片可以在列内和列之间拖动，看板名称、列名和任务都能就地改名，点击卡片在抽屉里查看和编辑详情。

<DocDemo src="blocks/kanban" column />

用到的组件：[Sortable](../components/sortable)、[Editable](../components/editable)、[Drawer](../components/drawer)、[Dropdown](../components/dropdown)、[Tag](../components/tag)、[Avatar](../components/avatar)、[User](../components/user)、[Select](../components/select)、[Dialog](../components/dialog)。

- 各列的 `DouSortable` 使用同一个 `group`，卡片可以拖到其他列。触摸时按住卡片片刻再拖动，直接滑动则是滚动看板。
- 卡片的菜单里也能“移到”其他列，在手机上不必横向拖动；键盘可以聚焦卡片后按 `Space` 拿起、方向键移动。
- 列头的 `+` 新建一张卡片并直接进入编辑，按 `Esc` 或留空则不保存。编辑时暂停拖动。
- 拖动后松手不会被当作点击：按下和松开的位置相距超过 4px 时不打开详情。
- 看板宽度小于 640px 时，列改为横向滑动，每次停在一列上；详情抽屉从底部弹出，可以在 60% 和全屏两档之间拖动，下滑关闭。宽度用 `useElementSize` 读取，按看板本身的宽度判断。
