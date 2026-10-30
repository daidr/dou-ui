---
wide: true
---

# 仪表盘

常见的概览页面：时间范围切换、带迷你图的统计卡片、部署日历、最近动态，以及一张带走势的服务列表。

<DocDemo src="blocks/dashboard" column />

用到的组件：[PageHeader](../components/page-header)、[SegmentedControl](../components/segmented-control)、[Card](../components/card)、[Statistic](../components/statistic)、[Sparkline](../components/sparkline)、[CalendarHeatmap](../components/calendar-heatmap)、[Timeline](../components/timeline)、[Table](../components/table)、[Tag](../components/tag)、[RelativeTime](../components/relative-time)。

- 统计卡片用 `auto-fit` 网格排列，窄屏时自动变为两列或一列；迷你图写 `width="100%"`，跟随卡片宽度。
- 响应时间和错误数上升不是好事，所以 Statistic 设置了 `:up-is-good="false"`。
- 服务列表里的迷你图用同一组 `min`、`max`，各行的高度可以直接比较。
