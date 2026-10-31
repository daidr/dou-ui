---
wide: true
---

# 门店排班

一家咖啡店下周的排班表：每格从早班、晚班、休息、请假里选，每人的工时和休息天数、每天每个班次的人数都由公式算出；人手不够或工时超标时，表格里的格子变色，下方列出需要调整的地方。

<DocDemo src="blocks/shifts" column />

用到的组件：[电子表格](../sheet/)、[PageHeader](../components/page-header)、[Card](../components/card)、[Badge](../components/badge)、[Empty](../components/empty)。

- 排班的格子用数据验证的 `list` 限制取值，选项带 `tone`，显示为不同颜色的标签；输入列表以外的文字会被拒绝。选中格子时旁边会提示两个班次的时间。
- 工时是 `(COUNTIF(…,"早班")+COUNTIF(…,"晚班"))*8`，格式 `0"h"` 在数字后面显示单位；下方两行用 `COUNTIF` 数出每天每个班次的人数。
- 条件格式：人数少于 2 的格子标黄，工时超过 40 或没有休息的标红。
- 下方的提醒用 `SheetFormulaEngine` 读取这些公式的结果。表格的 `transaction` 事件把每次修改交给引擎，改一格排班，提醒马上更新。
