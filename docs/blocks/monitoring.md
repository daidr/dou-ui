---
wide: true
---

# 实时监控

一个服务最近 5 分钟的运行指标，每秒更新一次。四张图表分别是每秒请求、5xx 错误率、延迟和 CPU：错误率和延迟标出告警线，延迟还标出超出目标的时段，CPU 标出高负载区间。暂停后四张图表可以一起缩放、平移。

<DocDemo src="blocks/monitoring" column />

用到的组件：[图表](../chart/)、[PageHeader](../components/page-header)、[Card](../components/card)、[Statistic](../components/statistic)、[Timeline](../components/timeline)、[Tag](../components/tag)。

- 每秒去掉最早的一个读数、在末尾加上新的，换成新数组传给 `data`。读数和当前时间有关，所以在 `onMounted` 里生成，服务端渲染的页面里先显示加载状态。
- 四张图表的 `DouChartZoom` 绑定同一个 `v-model:x`，数值轴设了同样的 `label-width`，绘图区左边对齐。实时更新时 `disabled` 关闭缩放，点“回到实时”时把范围设回 `null`。
- 延迟超过目标的时段从数据里算出来，每段用一个 `x` 给出两端的 `DouChartMarker` 标成区间；右侧的告警列表用的是同一份结果。
- 错误率和延迟的告警线用 `tone="danger"`，高负载区间用 `tone="warning"`，颜色只用在表达含义的地方；数据本身用色板的颜色。
