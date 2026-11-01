---
wide: true
---

# 经营看板

一家连锁门店的经营概况：统计卡片和去年同期比较，月度走势叠加去年的虚线和月目标，下方是品类、渠道和各区客群。点击一个品类，走势只看这个品类；走势图可以导出成图片。

<DocDemo src="blocks/business" column />

用到的组件：[图表](../chart/)、[PageHeader](../components/page-header)、[Card](../components/card)、[Statistic](../components/statistic)、[SegmentedControl](../components/segmented-control)、[Dropdown](../components/dropdown)。

- 走势图里今年是面积图、去年是虚线，两个系列共用一条数值轴。今年只到 10 月，11、12 月的值是 `null`，面积在 10 月结束，去年的线照常画完。
- 月目标用 `DouChartMarker` 画成参考线，数值轴会延伸到目标值；只看一个品类或看订单数时去掉它。
- 品类的柱状图监听 `select`：点击柱子得到它的 `x`，再点一次同一个品类回到全部。`color` 写成函数，选中一个品类时其余柱子变淡。
- 销售额和订单数的切换只是换一组数据，坐标轴的 `format` 跟着换单位，提示框和读屏读出的值也一起变化。
- 导出用图表实例上的 `exportPNG()` 和 `exportSVG()`，文件的下载由页面自己完成，可以用 [`downloadBlob`](../guide/composables#downloadblob)。
