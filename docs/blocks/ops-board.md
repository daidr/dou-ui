---
wide: true
---

# 运营大盘

一家网店一个月的运营数据：销售额、订单数、客单价和转化率，每日走势，渠道和品类构成，地区与品类的透视表，以及热销商品。可以按日期、渠道和地区筛选，点击图表或透视表也能筛选其他格子；打开“编辑布局”后可以拖动、调整和删除格子，改过的布局保存在浏览器里。

<DocDemo src="blocks/ops-board" column />

用到的组件：[仪表盘](../dashboard/dashboard)、[内置格子](../dashboard/widgets)、[PageHeader](../components/page-header)、[Switch](../components/switch)、[Button](../components/button)、[Tooltip](../components/tooltip)。

- 全部用内置格子：`stat`、`chart`、`pivot`、`table`、`text`。格子的数据来自 `sources`，同一个数据源和同一组筛选只请求一次，例如四个统计数字共用 `overview`。
- 饼图设置了 `filter: 'channel'`，和筛选栏的“渠道”是同一个筛选名，所以点击饼图的扇区时筛选栏也会显示这个渠道。柱状图的 `filter: 'category'` 没有对应的筛选栏控件，选中的品类显示在格子的标题栏上。
- 布局在 `v-model` 变化时写入 `localStorage`，打开页面时用 `migrateDocument` 读取，读取失败时回到默认布局。服务端渲染时没有 `localStorage`，所以在 `onMounted` 里读取。
- “恢复默认布局”用 `replaceWidgets` 算出从当前布局到默认布局的修改，再 `dispatch`，所以可以撤销。
- 编辑时显示撤销、重做和恢复默认，浏览时显示导出图片和打印。导出和打印会画出全部格子，包括还没滚动到的部分。
