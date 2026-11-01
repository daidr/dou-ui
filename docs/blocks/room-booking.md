---
wide: true
---

# 会议室预约

按会议室排列一天的预约：在空白处拖出一段时间即可预约，拖动会议可以改时间或换会议室，同一间会议室的预约不会重叠。

<DocDemo src="blocks/room-booking" column />

用到的组件：[资源排期](../gantt/scheduler)、[Dialog](../components/dialog)、[Form](../components/form)、[Select](../components/select)、[Input Time](../components/input-time)、[Segmented Control](../components/segmented-control)。

- 每间会议室是一个资源，`group` 按楼层分组；楼层切换只是过滤传给 `resources` 的数组。`range` 固定为当天，前后翻页时换成另一天。
- 在空白处拖出时间段时触发 `create`，这里打开对话框填写主题和发起人，确认后用 `transact` 添加，可以撤销。
- `can-move` 检查目标会议室在这段时间是否已被占用，被占用时拖动提示里显示原因，松手后不做修改。对话框保存时用同一个函数检查。
- 右键会议打开“编辑预约”，右键空白处打开“在这里预约”，用的是 `context-menu`，`target.time` 是指针下的时间。双击会议也能编辑。
- 会议室的人数和会议的发起人用 `resource`、`bar` 插槽显示。
- 手机上长按会议后拖动，直接滑动是滚动；长按空白处后拖动可以选出时间段。
