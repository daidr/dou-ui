---
wide: true
---

# 数据管理页

常见的列表管理页面：页头和新建按钮、筛选栏、可多选的表格、行操作菜单、批量删除、分页，以及在抽屉中新建和编辑。

<DocDemo src="blocks/data" column />

用到的组件：[PageHeader](../components/page-header)、[Input](../components/input)、[Select](../components/select)、[Table](../components/table)、[Tag](../components/tag)、[RelativeTime](../components/relative-time)、[Dropdown](../components/dropdown)、[Pagination](../components/pagination)、[Drawer](../components/drawer)、[Form](../components/form)、[Dialog](../components/dialog)、[Empty](../components/empty)、[Toast](../components/toast)。

- 筛选条件变化时回到第一页；没有结果时，表格的 `empty` 插槽给出“清除筛选”按钮。
- 选中行后，表格上方出现批量操作条。删除前用 `dialog.confirm` 确认。
- 新建和编辑共用一个抽屉表单。抽屉底部的按钮不在表单里，所以“保存”直接调用表单的 `validate()`。
