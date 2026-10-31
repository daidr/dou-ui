---
wide: true
---

# 部门预算

市场部一年的预算表：按季度填写各项目的预算和已执行金额，全年合计、执行率和按类别的汇总都由公式算出；超出预算的项目会标红，上方的数字跟着表格实时更新。

<DocDemo src="blocks/budget" column />

用到的组件：[电子表格](../sheet/)、[PageHeader](../components/page-header)、[Statistic](../components/statistic)、[Card](../components/card)、[Toast](../components/toast)。

- “明细”表的全年、执行率和合计行都是公式。“按类别”表用 `SUMIF` 引用“明细”表，改了明细里的金额或类别，汇总跟着变化。
- 执行率超过 100% 时用条件格式标红，全年预算画成数据条。这些规则在 `conditionalFormats` 里，也可以用工具栏的“条件格式”按钮修改。
- 类别从“按类别”表的第一列选（`list: '=按类别!$A$2:$A$7'`），负责人从固定的名单里选。已执行和四个季度的金额不能是负数，两处不相邻的区域写在一条规则里（`range: ['E2:E13', 'G2:J13']`）。“检查”按钮调用 `findInvalid()`，跳到第一个不符合规则的单元格。
- 上方的数字用 `useSheetFormulas` 读取公式的结果：表格的 `transaction` 事件交给它的 `update`，每次修改只重新计算受影响的公式。合计行按第一列的“合计”找到，插入或删除行之后仍然能读到。
- “下载 CSV”用 `toCSV()` 导出当前工作表，公式导出为计算结果。
