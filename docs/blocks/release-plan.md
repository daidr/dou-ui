---
wide: true
---

# 发布排期

一次版本发布从需求到上线的排期：任务按阶段分组，依赖之间自动顺延，标出关键路径，并和立项时保存的基线对比，看出哪些任务比计划推迟。排期可以导出成图片、表格或直接打印。

<DocDemo src="blocks/release-plan" column />

用到的组件：[甘特图](../gantt/)、[Toolbar](../components/toolbar)、[Segmented Control](../components/segmented-control)、[Switch](../components/switch)、[Dropdown](../components/dropdown)、[Toast](../components/toast)。

- `scheduling="auto"`：拖动一个任务时，依赖它的任务一起顺延，在同一步撤销。`critical` 标出没有余量的任务和连线，关掉开关即可隐藏。
- 基线用 `takeBaseline(tasks)` 保存，传给 `baseline` 后每个任务条下方有一条灰线标出计划位置；“比计划推迟”按任务的结束日期和基线比较得出。基线是普通数组，实际使用时和任务一起存到服务端。
- “负责人”是自定义列，读取任务的 `data.owner`；`markers` 标出代码冻结日和上线日。
- 导出用组件实例上的 `exportPNG()`、`exportSVG()`、`exportCSV()` 和 `print()`，内容和屏幕上一致；文件的下载由页面自己完成，可以用 [`downloadBlob`](../guide/composables#downloadblob)。
- 刻度切换用 `v-model:scale`；按住 `Ctrl` / `⌘` 滚动或双指捏合时，刻度也会跟着更新。
- 宽度小于 520px 时表格自动收起，任务名显示在时间轴上；工具栏换行排列。
