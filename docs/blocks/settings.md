---
wide: true
---

# 设置页

左侧切换分区，右侧是对应的表单。修改任意一项后，底部出现“有未保存的更改”提示条，可以保存或放弃。

<DocDemo src="blocks/settings" column />

用到的组件：[Menu](../components/menu)、[Form](../components/form)、[Avatar](../components/avatar)、[Input](../components/input)、[Textarea](../components/textarea)、[Select](../components/select)、[Switch](../components/switch)、[SegmentedControl](../components/segmented-control)、[Radio](../components/radio)、[Toast](../components/toast)。

- 表单绑定的是一份副本，另存一份已保存的值，两者不同时就说明有未保存的修改。放弃时用已保存的值覆盖副本。
- 通知列表的每一行用 `<label>` 包住文字和开关，点击整行都能切换。
- 窄屏下菜单移到表单上方。
