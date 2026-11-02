---
wide: true
---

# 计算值

`formula` 用已有的字段算出新的值，比如每杯的均价、毛利率。

## 基础用法

<DocDemo src="pivot/formula" />

公式里的字段名（或字段的 `label`）表示这个字段在这一格的合计。所以小计和总计里算的是“合计之比”，而不是把各组的比值相加。

```ts
// “毛利”和“销售额”是两个字段的 label
values: ['amount', { formula: '毛利 / 销售额', label: '毛利率', format: { style: 'percent' } }]
```

## 写法

公式里可以用：

- 数字、`+ - * /` 和括号；
- `sum(字段)`、`avg(字段)`、`min(字段)`、`max(字段)`、`count(字段)`（非空的个数）和 `count()`（记录的条数）；
- 方括号括起有空格或符号的字段名，如 `[unit price]`。

除以 0 的格子留空。公式只做解析和计算，不会执行任何代码。

字段面板值区域的“添加计算值”可以在界面里写公式，写错时会指出原因。

## 检查公式

`@dou-ui/pivot/engine` 提供两个函数，可以在保存前检查公式：

```ts
import { checkPivotFormula, parsePivotFormula, PivotSource } from '@dou-ui/pivot/engine'

parsePivotFormula('(amount - cost) / amount') // 只检查写法
checkPivotFormula(new PivotSource(orders, { fields }), '毛利 / 销售额') // 还检查字段是否存在、是否是数字
```

公式有错时抛出 `PivotFormulaError`：`code` 说明原因，`at` 是出错处在公式里的位置，`detail` 是相关的文字（如写错的字段名）。

## API

### PivotFormulaError

| 名称     | 说明                         | 类型     |
| -------- | ---------------------------- | -------- |
| `code`   | 出错的原因                   | `string` |
| `at`     | 出错处在公式里的字符位置     | `number` |
| `detail` | 相关的文字，比如写错的字段名 | `string` |

`code` 的取值和语言包 `formula.errors` 的键相同，可以通过 `messages` 改写对应的提示。
