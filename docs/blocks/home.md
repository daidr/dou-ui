---
wide: true
---

# 可自定义的首页

办公应用的个人首页：快捷入口、待审批和年假、待办、今日日程和公告。点“自定义首页”后可以从左侧添加格子，拖动、调整大小和删除格子，改过的首页保存在浏览器里。

<DocDemo src="blocks/home" column />

用到的组件：[仪表盘](../dashboard/dashboard)、[内置格子](../dashboard/widgets)、[PageHeader](../components/page-header)、[Checkbox](../components/checkbox)、[Input](../components/input)、[Tag](../components/tag)、[Button](../components/button)。

- 待办、今日日程、公告和快捷入口是自己写的格子类型，和内置的 `stat`、`text` 一起放在 `widgets` 里。编辑时左侧的 `DouDashboardPalette` 列出全部类型，可以点击或拖进来。
- 待办的勾选和新增通过 `setProps` 写回格子的 `props`，和布局保存在同一份文档里，也可以撤销。
- 快捷入口在文档里只保存入口的 id（`props.ids`），图标和名字在代码里查，所以文档可以直接转成 JSON 保存。它有自己的设置表单，编辑时从格子的菜单打开，勾选要显示的入口。
- 首页在 `v-model` 变化时写入 `localStorage`，挂载后用 `migrateDocument` 读取；“恢复默认”用 `replaceWidgets` 回到默认首页，可以撤销。
- 窄屏时左侧的格子列表移到上方，横向排列。
