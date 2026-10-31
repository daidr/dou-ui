---
wide: true
---

# 门店对比

两种常见的对比：按月和去年同期比较，以及在门店分布里框选一部分，和全部门店的平均值比较。

<DocDemo src="blocks/compare" column />

用到的组件：[图表](../chart/)、[PageHeader](../components/page-header)、[Card](../components/card)、[Statistic](../components/statistic)、[Table](../components/table)、[Empty](../components/empty)。

- 月度销售额是两组并排的柱子，同比增长画在右侧的 `y2` 轴上；新店开业之后的几个月用 `x` 给出两端的标注标成区间。
- 门店分布是散点图，两条参考线是全部门店的平均面积和平均销售额，把门店分成四块。
- `DouChartBrush` 设为 `axis="xy"` 框选一块区域，`select` 事件的 `rows` 是选中的门店。选区用 `v-model:x`、`v-model:y` 绑定，“清除”按钮把两者设回 `null`。手机上按住片刻再拖动是框选，直接滑动仍是滚动页面。
- 右侧的统计卡片和全部门店的平均值比较，表格按月销售额从高到低排列。
