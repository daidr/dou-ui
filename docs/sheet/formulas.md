# 公式

以 `=` 开头的值是公式，单元格显示它的计算结果。改动单元格后，只有依赖它的公式重新计算。

<DocDemo src="sheet/formulas" column />

## 编辑公式

在单元格里输入公式时，公式里的引用按颜色区分，表格上用同样颜色的框标出引用的区域；函数名、文字、数字和错误值也各有颜色，单元格和编辑栏里的颜色相同。

- **插入引用**：光标在 `=`、运算符、`(` 或 `,` 后面时，点击单元格或拖选区域，会把它的地址写到光标处；继续点击或拖选会替换刚写入的地址，按住 `Shift` 点击扩大区域。键盘上，以输入开始的编辑（而不是双击或 `F2`）可以用方向键移动到要引用的单元格，`Shift` 加方向键选出区域。输入其他字符后，下一次点击写入新的引用。
- **函数补全**：输入函数名的开头时，列出名字以它开头的函数和说明，常用的函数（`SUM`、`AVERAGE`、`IF`、`COUNT` 等）排在前面，其余按字母顺序。上下方向键选择，`Tab` 或 `Enter` 写入函数名和 `(`，`Esc` 关闭列表。
- **参数提示**：光标在函数的括号里时，提示函数的参数，当前所在的参数加粗显示。

函数的说明跟随表格的语言，可以用 `messages.functions` 修改；`defineSheetFunction` 定义的函数可以用 `args` 和 `description` 给出自己的说明。

## 编辑栏

`DouSheetFormulaBar` 放在表格的 `header` 插槽里，左边是单元格地址，右边是当前单元格的公式或值。

<DocDemo src="sheet/formula-bar" column />

- 编辑栏和单元格同步：在任一处输入，另一处同时显示，在编辑栏里同样可以点击单元格插入引用、补全函数名。`Enter` 保存，`Esc` 放弃，`Tab` 保存后移到右边的单元格。
- 在地址框里输入 `B3`、`A1:C4` 或 `表2!A1` 后按 `Enter`，会选中并滚动到那里；地址写错时地址框标红，输入的文字保留并选中，可以直接改，按 `Esc` 恢复；读屏软件会读出提示。

### 代码版编辑栏

`@dou-ui/sheet/code` 提供的 `DouSheetCodeFormulaBar` 用[代码编辑器](/code/)的 `DouCodeInput` 显示公式：颜色和单元格里相同，另外括号成对高亮，写错的地方加波浪线，用了不存在的函数也会提示。编辑方式和 `DouSheetFormulaBar` 相同，函数列表、参数提示和点击单元格插入引用照常使用。它需要安装 `@dou-ui/code` 并引入它的样式：

```ts
import '@dou-ui/code/style'
import { DouSheetCodeFormulaBar } from '@dou-ui/sheet/code'
```

<DocDemo src="sheet/code-formula-bar" column />

公式的语言 `sheetFormula` 也从 `@dou-ui/sheet/code` 导出，可以交给 `DouCodeInput` 或 `DouCodeEditor` 在别处编辑公式。

## 写法

公式的写法和常见的表格软件一致，函数名不区分大小写，参数用 `,` 分隔（也可以用 `;`）。

| 写法                                 | 说明                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `12`、`1.5e3`、`"文字"`、`TRUE`      | 数字、文字（文字里的 `"` 写成 `""`）、布尔值                       |
| `A1`、`$A$1`                         | 单元格；`$` 只影响复制和填充时引用是否跟着移动                     |
| `A1:C4`、`B:B`、`2:3`                | 区域、整列、整行                                                   |
| `表2!A1`、`'九月 上海'!B2:B9`        | 其他工作表；名字里有空格或符号时用 `'` 括起来                      |
| `+ - * / ^`、`%`                     | 加减乘除、乘方、百分比（`50%` 是 `0.5`）                           |
| `&`                                  | 连接文字                                                           |
| `= <> < > <= >=`                     | 比较，结果是 `TRUE` 或 `FALSE`；比较文字时不区分大小写             |
| `SUM(A1:A9)`、`IF(A1>0, "正", "负")` | 函数调用，可以嵌套；省略的参数写成空，比如 `XLOOKUP(1,A:A,B:B,,1)` |

在函数的参数里，运算符可以作用于整个区域，逐个单元格计算，得到同样大小的一组值：`=SUM(A1:A4*2)` 是 `A1` 到 `A4` 的两倍之和，`=SUMPRODUCT((A1:A9="上海")*B1:B9)` 是 `A` 列为“上海”的行在 `B` 列的合计。区域和单个值计算时，单个值用于每个单元格；两个区域大小不同时，超出较小区域的部分是 `#N/A`。单元格本身只显示一个值，所以 `=A1:A4*2` 直接写在单元格里得到 `#VALUE!`。

运算顺序从先到后是：负号、`%`、`^`、`* /`、`+ -`、`&`、比较。负号先于乘方，所以 `=-2^2` 是 `4`，和常见的表格软件一样；`2^3^2` 从左往右算，是 `64`。

## 值的类型

公式里的值是数字、文字、`TRUE` / `FALSE`、空或错误值。需要数字的地方，`TRUE` 当作 `1`，空单元格当作 `0`，能读成数字的文字（`"12"`、`"1,280"`、`"12%"`）按数字算，其他文字得到 `#VALUE!`。

日期和时间按单元格的写法保存为文字（`'2026-03-05'`、`'09:30'`、`'2026-03-05 09:30'`），参与计算时按天数算，时间是一天的几分之几（`09:30` 是 `0.3958…`）：

- 日期加减天数得到日期，日期加时间得到日期和时间；两个日期相减得到相差的天数。
- 时间加减时间或天数得到时间，两个时间相减得到间隔的时长，也写成时间（`01:30`）。结果满一天或小于 0 时不能写成时间，得到天数；时长要换成小时，乘以 24 即可。

| `A1` 是 `2026-03-05`，`B1` 是 `09:30` 时 | 结果               |
| ---------------------------------------- | ------------------ |
| `=A1+30`                                 | `2026-04-04`       |
| `=A1-"2026-03-01"`                       | `4`                |
| `=A1+B1`                                 | `2026-03-05 09:30` |
| `=B1+TIME(1, 0, 0)`                      | `10:30`            |
| `="11:00"-B1`                            | `01:30`            |
| `=("11:00"-B1)*24`                       | `1.5`              |
| `=A1>"2026-01-01"`                       | `TRUE`             |
| `=YEAR(A1)`                              | `2026`             |

结果按单元格的 `format` 显示，比如公式单元格设了 `¥#,##0`，结果就显示为金额。单元格只引用一个空单元格时显示 `0`。

## 错误值

公式出错时，单元格显示错误值，用红色文字居中显示；鼠标悬停时显示原因，读屏软件也会读出原因，原因的文字可以用 `messages.errors` 逐个修改。引用了出错的单元格时，错误会一直传下去，可以用 `IFERROR` 换成别的值。

| 错误值    | 原因                                           |
| --------- | ---------------------------------------------- |
| `#DIV/0!` | 除以 0，或者求平均值时没有数字                 |
| `#N/A`    | 查找函数没有找到                               |
| `#NAME?`  | 没有这个函数                                   |
| `#NUM!`   | 数字超出范围，比如负数开平方                   |
| `#REF!`   | 引用的工作表不存在，或者引用的单元格已经被删除 |
| `#VALUE!` | 值的类型不对，比如文字参与加法、参数个数不对   |
| `#CYCLE!` | 公式直接或间接引用了自己                       |
| `#ERROR!` | 写法有误，比如括号不配对，`=1+` 没写完         |

## 函数

| 类别     | 函数                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 数学     | `SUM` `PRODUCT` `SUMPRODUCT` `ABS` `INT` `TRUNC` `SIGN` `SQRT` `POWER` `EXP` `LN` `LOG` `LOG10` `PI` `MOD` `ROUND` `ROUNDUP` `ROUNDDOWN` `CEILING` `FLOOR` `MROUND` `RAND` `RANDBETWEEN`                                             |
| 统计     | `AVERAGE` `MEDIAN` `MIN` `MAX` `LARGE` `SMALL` `RANK` `RANK.EQ` `COUNT` `COUNTA` `COUNTBLANK` `STDEV` `STDEV.S` `STDEV.P` `VAR` `VAR.S` `VAR.P` `PERCENTILE` `PERCENTILE.INC`                                                        |
| 逻辑     | `IF` `IFS` `SWITCH` `CHOOSE` `IFERROR` `IFNA` `AND` `OR` `XOR` `NOT` `NA` `ISBLANK` `ISNUMBER` `ISTEXT` `ISLOGICAL` `ISERROR` `ISERR` `ISNA` `ISEVEN` `ISODD`                                                                        |
| 文字     | `CONCAT` `CONCATENATE` `TEXTJOIN` `LEFT` `RIGHT` `MID` `LEN` `TRIM` `CLEAN` `UPPER` `LOWER` `PROPER` `EXACT` `REPT` `SUBSTITUTE` `REPLACE` `FIND` `SEARCH` `TEXTBEFORE` `TEXTAFTER` `TEXT` `VALUE` `CHAR` `CODE` `UNICHAR` `UNICODE` |
| 日期     | `TODAY` `NOW` `DATE` `TIME` `YEAR` `MONTH` `DAY` `HOUR` `MINUTE` `SECOND` `WEEKDAY` `WEEKNUM` `ISOWEEKNUM` `DATEDIF` `DAYS` `EDATE` `EOMONTH` `NETWORKDAYS` `WORKDAY` `DATEVALUE` `TIMEVALUE`                                        |
| 条件统计 | `SUMIF` `AVERAGEIF` `COUNTIF` `SUMIFS` `AVERAGEIFS` `COUNTIFS` `MAXIFS` `MINIFS`                                                                                                                                                     |
| 查找     | `VLOOKUP` `HLOOKUP` `MATCH` `XMATCH` `INDEX` `XLOOKUP` `ROWS` `COLUMNS`                                                                                                                                                              |
| 财务     | `PMT` `FV` `PV` `NPV`                                                                                                                                                                                                                |

函数的参数和结果和常见的表格软件一致，下面按表格的类别列出需要注意的地方：

- `SUM`、`AVERAGE` 这类函数在区域里只算数字、日期和时间，其他文字和空单元格跳过；直接写在参数里的 `"2"`、`TRUE` 会按数字算。参数全是时间时，`SUM` 的结果也是时间，满一天时得到天数；汇总工时这类可能超过一天的时长，写成 `=SUM(B1:B9)*24` 得到小时数。参数全是日期或全是时间时，`AVERAGE`、`MEDIAN`、`MAX`、`MIN` 的结果是日期或时间。
- `TODAY()`、`NOW()`、`RAND()`、`RANDBETWEEN()` 每次修改后都会重新计算。
- `ROUND` 按十进制四舍五入，`ROUND(1.005, 2)` 是 `1.01`，负数向远离 0 的方向舍入；`MROUND` 同样四舍五入到基数的倍数。
- `RANK` 和 `RANK.EQ`、`STDEV` 和 `STDEV.S`、`VAR` 和 `VAR.S`、`PERCENTILE` 和 `PERCENTILE.INC` 结果相同，两种写法都可以用。
- `IF`、`IFS`、`SWITCH`、`CHOOSE`、`IFERROR` 只计算用到的那个分支，`=IF(A1=0, 0, B1/A1)` 不会因为 `A1` 是 0 而出错。分支可以是区域，比如 `=SUM(CHOOSE(2, A1:A9, B1:B9))`。
- `SWITCH` 的参数个数为偶数时，最后一个是没有匹配时的默认值。它判断相等的方式和 `=` 相同，空单元格等于 `0`，也等于 `""`。
- `TEXT` 的格式写法和单元格的 `format` 一样；数字用日期或时间的格式时按天数读，比如 `=TEXT(0.5, "hh:mm")` 是 `12:00`。
- `CHAR`、`CODE` 按 Unicode 计算，`CHAR` 只接受 1 到 255；更大的编码用 `UNICHAR`、`UNICODE`。
- `TEXTBEFORE`、`TEXTAFTER` 的分隔符为空文字时，`TEXTBEFORE` 得到空文字，`TEXTAFTER` 得到整段文字。
- 返回日期或时间的函数（`DATE`、`TIME`、`EDATE`、`EOMONTH`、`WORKDAY`、`DATEVALUE`、`TIMEVALUE`）得到的是 `2026-03-05`、`09:30` 这样的值，和在单元格里输入的日期、时间相同，可以接着计算，见[值的类型](#值的类型)。`DATEVALUE` 能读懂单元格输入时能读懂的写法，比如 `2026/3/5`。
- `NETWORKDAYS`、`WORKDAY` 把周六、周日当作休息日，第三个参数可以给出假日所在的区域。`WEEKNUM` 的第二个参数是 `1`（周日开始，默认）、`2`（周一开始）、`11` 到 `17`（依次从周一到周日开始）或 `21`（ISO 周，和 `ISOWEEKNUM` 相同）。
- `SUMIF`、`COUNTIF` 等的条件可以是一个值，也可以是 `">=80"`、`"<>完成"`、`"上海*"` 这样的文字：`*` 匹配任意多个字，`?` 匹配一个字，`~*` 表示 `*` 本身；`""` 匹配空单元格。日期也可以比较，比如 `">=2026-02-01"`。
- `VLOOKUP` 和 `MATCH` 默认按近似查找，要求第一列从小到大排好；精确查找要把最后一个参数写成 `FALSE`（`MATCH` 是 `0`）。`XLOOKUP` 默认精确查找，第五个参数 `-1` / `1` 找下一个较小 / 较大的值，`2` 用通配符。`XMATCH` 的查找方向是 `1`（从前往后，默认）、`-1`（从后往前）、`2` / `-2`（在从小到大 / 从大到小排好的数据里二分查找）。
- `PMT`、`FV`、`PV` 的符号表示钱的方向：收到的钱为正，付出的钱为负。按月计算时把年利率除以 12，比如 30 万贷款 30 年，`=PMT(4.9%/12, 360, 300000)` 的月供约为 `-1592.18`。

## 计算方式

公式在要显示的时候才计算，表格只计算看得见的单元格，以及它们依赖的单元格。算出的结果会保留，直到它依赖的单元格变化：每次修改后，只有依赖被改单元格的公式（包括间接依赖的）重新计算，其他结果不动，没有变化的行也不会重绘。插入、删除、移动行列和工作表，以及从外部整个替换 `v-model` 时，所有结果重新计算。

很长的依赖链也能计算，比如一列 10 万行、每行引用上一行的累计值。

复制成纯文本、导出 CSV（`toCSV`）和读屏软件读到的都是计算结果；复制后粘贴回表格时仍然是公式。`useSheet()` 的 `result(point)` 返回单元格的计算结果，`value(point)` 返回公式本身。

## 自定义函数

`defineSheetFunction` 定义一个函数，放进扩展的 `functions` 里：

```ts
import {
  defineSheetExtension,
  defineSheetFunction,
  isSheetError,
  scalarOf,
  toNumber,
} from '@dou-ui/sheet'

// 含税价：TAX(金额, 税率)，税率默认 6%
const TAX = defineSheetFunction({
  name: 'TAX',
  minArgs: 1,
  maxArgs: 2,
  run: ([amountArg, rateArg]) => {
    // 按位置取参数：空单元格和省略的参数当作 0
    const amount = toNumber(scalarOf(amountArg!))
    const rate = rateArg === undefined ? 0.06 : toNumber(scalarOf(rateArg))
    if (isSheetError(amount)) return amount
    if (isSheetError(rate)) return rate
    return amount * (1 + rate)
  },
})

const finance = defineSheetExtension({ name: 'finance', functions: [TAX] })
```

| 字段       | 说明                                                                                 | 类型                         |
| ---------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| `name`     | 公式里调用时的名字，不区分大小写；和内置函数同名时替换内置的                         | `string`                     |
| `run`      | 计算结果。收到每个参数的值，引用多个单元格的参数收到区域；返回结果，出错时返回错误值 | `(args, ctx) => SheetResult` |
| `minArgs`  | 最少几个参数，少了得到 `#VALUE!`                                                     | `number`                     |
| `maxArgs`  | 最多几个参数，多了得到 `#VALUE!`                                                     | `number`                     |
| `lazy`     | 为 `true` 时每个参数收到一个函数，调用它才计算这个参数，像 `IF` 那样只算用到的参数   | `boolean`                    |
| `volatile` | 每次修改后都重新计算，像 `TODAY`                                                     | `boolean`                    |

参数是区域时收到 `SheetRangeArg`：`rows`、`cols` 是大小，`at(row, col)` 取其中一格（从 0 开始），`entries()` 依次给出有内容的格子 `[row, col, value]`，跳过空格子，所以整列 `A:A` 也只遍历有数据的部分。`ctx.now` 是这次计算的时间，`ctx.locale` 是表格的语言。`run` 抛出异常时结果是 `#VALUE!`。

处理参数的工具都可以从 `@dou-ui/sheet` 导入。参数各有含义时按位置用 `scalarOf` 和 `toNumber` 取值；`numbersOf` 把所有参数里的数字收在一起，跳过空单元格，适合 `SUM` 这样不在乎参数位置的函数。

| 名称                                  | 说明                                                             |
| ------------------------------------- | ---------------------------------------------------------------- |
| `numbersOf(args)`                     | 参数里所有的数字，规则同 `SUM`，跳过空单元格；遇到错误值时返回它 |
| `scalarOf(arg)`                       | 一个值：一格的区域取那一格，更大的区域得到 `#VALUE!`             |
| `toNumber`、`toText`、`toBoolean`     | 按公式的规则转换，不能转换时返回 `#VALUE!`                       |
| `compareValues(a, b)`                 | 按公式的规则比较两个值，返回负数、`0` 或正数                     |
| `criteriaOf(criteria)`                | 把 `SUMIF` 那样的条件变成判断函数 `(value) => boolean`           |
| `serialOf(text)`、`dateText(serial)`  | 日期文字和天数（从 1899-12-30 算起）互相转换                     |
| `SheetError.of(code)`、`isSheetError` | 得到错误值（比如 `SheetError.of('#N/A')`）、判断是不是错误值     |

## 在表格之外读取结果

页面上表格以外的地方（比如表格上方的合计数字）要用公式的结果时，用 `useSheetFormulas`。它对 `v-model` 绑定的同一个工作簿计算公式，在 `computed` 或模板里读取的结果会随表格的修改更新：

```vue
<script setup>
import { DouSheet, useSheetFormulas } from '@dou-ui/sheet'
import { computed, ref } from 'vue'

const book = ref({ sheets: [{ name: '预算', cells: [[1200], [800], ['=SUM(A1:A2)']] }] })
const formulas = useSheetFormulas(book)
const total = computed(() => formulas.result(0, 'A3'))
</script>

<template>
  <p>合计：{{ total }}</p>
  <DouSheet v-model="book" @transaction="formulas.update" />
</template>
```

把表格的 `transaction` 事件交给 `update` 后，每次修改只重新计算受影响的公式；不传时，工作簿每变化一次都全部重新计算，结果同样正确。从外部整个替换工作簿时也会全部重新计算。

| 名称                               | 说明                                                               |
| ---------------------------------- | ------------------------------------------------------------------ |
| `useSheetFormulas(book, options?)` | `book` 是工作簿的 ref 或 getter；`options` 同 `SheetFormulaEngine` |
| `result(sheet, cell)`              | 单元格的结果，参数同下方引擎的 `result`                            |
| `evaluate(formula, sheet?)`        | 计算一个公式，不写进单元格                                         |
| `update(tr)`                       | 交给它表格的 `transaction` 事件                                    |
| `engine`                           | 下面的计算引擎                                                     |

完整的例子见区块[部门预算](../blocks/budget)。

## 单独使用计算引擎

不显示表格时，也可以用 `SheetFormulaEngine` 计算工作簿里的公式，比如在服务端生成报表：

```ts
import { SheetTransaction } from '@dou-ui/sheet/core'
import { SheetFormulaEngine } from '@dou-ui/sheet/formula'

const engine = new SheetFormulaEngine(book, { functions: [TAX] })
engine.result(0, 'D7') // 第一个工作表 D7 的结果
engine.evaluate('=SUM(D2:D5)/4') // 不写进单元格，直接算一个公式

// 修改后把事务交给引擎，只重新计算受影响的公式
const tr = new SheetTransaction(engine.doc).setValue('B2', 1500)
engine.update(tr)
```

| 名称                                     | 说明                                                                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new SheetFormulaEngine(doc?, options?)` | 选项有 `functions`（追加的函数）、`locale`（`TEXT` 用的语言）、`now`（`TODAY` 用的时间）                                                                        |
| `result(sheet, cell)`                    | 单元格的结果：公式的计算结果，或者单元格的值。`sheet` 是工作表的序号或 `id`（没有 `id` 时是名字）；`cell` 写 `'D7'`、`{ row, col }`，或者分成行号和列号两个参数 |
| `isFormula(sheet, cell)`                 | 单元格是不是公式，参数同 `result`                                                                                                                               |
| `evaluate(formula, sheet?)`              | 在某个工作表上计算一个公式，不保留结果                                                                                                                          |
| `update(tr)`                             | 修改之后调用，传入事务（或同样带 `doc`、`steps`、`before` 的对象）；事务不是基于引擎现有的工作簿时整个重新计算                                                  |
| `load(doc)`                              | 换成另一个工作簿，所有结果重新计算                                                                                                                              |
| `doc`                                    | 引擎现有的工作簿                                                                                                                                                |
| `hasFunction(name)`                      | 有没有这个函数，内置的或追加的                                                                                                                                  |
| `rowVersion(sheet, row)`                 | 这一行的结果最后一次变化的编号，可以用来判断是否需要重绘                                                                                                        |

`parseFormula(text)` 把公式读成语法树，写法有误时抛出 `SheetFormulaSyntaxError`（带出错的位置 `at`）；`referencesOf(node)` 列出其中所有的引用。

`sheetToCSV` 和 `formatClip` 的 `result` 选项给出公式单元格的结果，有了它导出的就是计算结果。它收到行号和列号：`sheetToCSV` 里是在工作表中的位置，`formatClip` 里是在剪贴块中的位置（从 0 开始），需要自己加上剪贴块左上角的位置：

```ts
const csv = sheetToCSV(book.sheets[0], { result: (row, col) => engine.result(0, row, col) })
const clip = formatClip(cells, { result: (row, col) => engine.result(0, top + row, left + col) })
```
