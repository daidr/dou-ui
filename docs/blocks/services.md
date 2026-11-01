---
wide: true
---

# 服务大盘

一组线上服务的运行情况：每个服务的状态、P95 延迟和错误率，汇总的请求量、延迟、错误率和可用率，最近 3 分钟的延迟曲线，各接口的错误数和告警记录。数据每 5 秒刷新一次；点击左侧的一个服务，其他格子只显示这个服务。

<DocDemo src="blocks/services" column />

用到的组件：[仪表盘](../dashboard/dashboard)、[数据与筛选](../dashboard/data)、[内置格子](../dashboard/widgets)、[PageHeader](../components/page-header)、[Badge](../components/badge)、[Button](../components/button)、[Tooltip](../components/tooltip)。

- 数据源写成 `{ load, interval, filters }`：`interval: 5000` 让它每 5 秒重新加载，页面不可见时暂停；`filters: ['service']` 表示只用 `service` 这一个筛选，服务列表本身的数据源写 `filters: []`，选中服务时不会重新加载。
- 服务列表是自己写的格子类型。它用 `useDashboardWidget()` 的 `data` 读取数据，点击时调用 `setFilter('service', id, { label: name })`；`label` 是标题栏上显示的名字，筛选的值仍然是服务的 id。`ownFilters` 用来标出选中的服务，格子本身不受这个筛选影响。
- 状态圆点用 Badge 的 `dot`，并通过 `label` 给读屏提供“正常”“偏慢”“异常”的文字。
- 右上角的按钮调用 `refresh()` 立即重新加载所有数据源。
- 这个页面只用来查看，没有打开 `editable`；需要调整布局时可以参考[运营大盘](./ops-board)。
