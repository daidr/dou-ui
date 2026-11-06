---
type: 新增
packages: [dou-ui, theme]
---

`DouTabs` 支持拖动排序：`draggable` 后可以用指针拖动标签（触屏先按住），也可以按 `Alt` 加方向键挪动；`group` 相同的几组标签之间可以互相拖，`name` 区分各组，统一发出 `move` 事件。新增 `DouDock` 停靠面板：`v-model` 是可以存成 JSON 的布局树，把标签拖到一组的边缘拆出新组、拖到中间并入，空组自动合并，尺寸用分隔线调整；另导出 `moveDockTab`、`splitDockTab`、`removeDockTab` 等函数用来做菜单。
