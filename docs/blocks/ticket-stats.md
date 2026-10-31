---
wide: true
---

# 工单统计

客服中心两个月的工单：各团队、各类问题的工单数、平均处理时长和超时率，可以按优先级、按周或按渠道展开，只看每个团队最主要的问题。

<DocDemo src="blocks/ticket-stats" column />

用到的组件：[数据透视](../pivot/)、[PageHeader](../components/page-header)、[Card](../components/card)、[Statistic](../components/statistic)、[SegmentedControl](../components/segmented-control)、[Switch](../components/switch)。

- 三个值：`count` 计数，配上数据条（`mark: 'bar'`）；`hours` 的 `avg` 平均时长；超时率是计算值 `sum(overdue) / count()`，`overdue` 是 0 或 1，小计和总计同样按“合计之比”计算，`mark: { type: 'scale', tone: 'warning' }` 让超时率越高的格子颜色越深。不同优先级的时长差别很大，所以色阶放在可以直接比较的超时率上。
- “按周”把创建日期按周分组（`{ field: 'created', by: 'week' }`），组名是“2026 年第 36 周”。
- “只看主要问题”给问题字段加上 `top: { count: 2 }` 筛选：在每个团队里保留工单最多的 2 类，被筛掉的问题不计入总计。
- `config` 写成 `computed`，由页面上的开关和分段控件算出；表格只展示，不修改它，所以没有用 `v-model:config`。
- 表格用 `size="sm"` 和较窄的列宽，三个值并排时也能在一屏内看完。
