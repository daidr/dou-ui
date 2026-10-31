---
wide: true
---

# 销售分析

一家茶饮连锁全年订单的分析页：在字段面板里拖动字段，或者一键切换几种常用的看法；点击任意数字查看这一格的订单，下方的透视图跟着表格变化，整张表可以复制、下载或打印。

<DocDemo src="blocks/sales-analysis" column />

用到的组件：[数据透视](../pivot/)、[图表](../chart/)、[PageHeader](../components/page-header)、[SegmentedControl](../components/segmented-control)、[Dropdown](../components/dropdown)、[Drawer](../components/drawer)、[Table](../components/table)、[Toast](../components/toast)。

- 字段面板和表格绑定同一个 `config`。上方的几种看法只是几份写好的 `config`，切换后仍然可以在面板里继续调整。
- “品类占比”用 `show: 'percentOfRow'` 显示每个品类在大区里的占比，再用 `mark: 'scale'` 给数字上色；“渠道 × 月份”有两个值，用 `valuesOn: 'rows'` 放在行上，第二个值是 `runningTotal` 累计。
- 透视图在 `computed` 里调用 `toChartRows({ valueIndex: 0 })`，表格展开、折叠或换了看法时自动更新；纵轴的 `format` 用系列带的 `format`，和表格写法一致。显示的是累计或占比时，柱子不再堆叠。
- 点击数字触发 `cell-click`，`records()` 取出这一格的订单，在抽屉里用虚拟滚动的表格列出。
- 导出用表格实例上的 `copy({ all: true })`、`toCSV()` 和 `print()`；文件的下载由页面自己完成。在表格里拖动选中一片格子，按 `Ctrl` / `⌘` + `C` 也能复制。
