# 导入

`importCSV(text)` 把 CSV 里的任务放进甘特图，可以一步撤销。它能读取 [`toCSV`](./export#csv) 写出的内容，在表格软件里改过日期、增删过行之后再导入。

## 基础用法

<DocDemo src="gantt/import" column />

```ts
const result = gantt.value.importCSV(await file.text())
if (result?.warnings.length) toast.warning(`${result.warnings.length} 个值没有读出`)
```

`readonly` 时 `importCSV` 不做任何修改，返回 `null`。只想读取、不想放进甘特图时用 `readCSV(text)`，返回值相同，可以检查后再决定怎么处理，例如交给 [`transact`](./transactions)。

## 列

按表头找列：

- 任务名称、开始、结束、工期、进度这五个字段总能认出，不论 `columns` 里有没有它们；
- 表头可以是当前语言或任一内置语言的列名（“任务”“Task”……）、列自己的 `title`，或字段名 `title`、`start`、`end`、`duration`、`progress`；
- 必须有任务名称一列，否则抛出 `GanttCSVError`；
- 自定义列按 `parse` 转换后写进 `data`，没有 `parse` 时写入原文。只用 `value` 读取的列无法写回，这一列不会读取，也不算认不出的表头。

## 日期和工期

- 日期写成 `2026-03-02` 或 `2026-03-02 09:30`。表格软件另存时改成的 `2026/3/2`、`2026-3-2`、`2026.3.2`（可以带 `9:30` 或 `09:30:00`）也能读出。
- 有“结束”列时按它；只有“工期”时按工作日历往后数。表头里的单位决定是工作日还是工作小时，值里写了单位（`5 天`、`2 小时`、`2h`）时以值为准。按天的工期必须是正整数，按小时的精确到分钟。
- “进度”是 0–100 的数字，可以带 `%`。
- 日期要从“开始”算起：没有开始日期的行，写了结束或工期也读不出。有“开始”、但“结束”和“工期”都空着的行是里程碑，和导出时一致。
- 文件里既没有“结束”也没有“工期”时，任务保持原来的工作量，移动到新的开始日期。
- 用分号分隔的文件（一些表格软件按地区设置这样保存）里，数字的小数点可以是逗号，如 `1,5`。

`toCSV({ text: true })` 写出的是显示的文字（`3月2日`、`5 天`），不能再导入。

## 按 ID 更新

导出时加上 `ids: true`，导入时就能按 ID 对应回原来的任务：

- ID 已经存在的任务只更新文件里有、并且读得出的字段，颜色、锁定、`data` 里的其他字段和依赖都保留；
- 文件里新增的行（ID 为空）成为新任务；
- 文件里没有的任务连同它的依赖一起删除；
- 行的顺序和层级按文件调整。

没有 ID 列时，文件里的任务整体替换原有任务，汇总任务也会变成普通任务，依赖不会保留。

`mode: 'append'` 把文件里的任务加到最后，不删除原有任务：ID 已被占用时换一个新的 ID，上级任务 ID 也可以指向甘特图里已有的任务。默认是 `replace`，因为最常见的用法是把导出的文件改完再导回来。

## Excel 文件

Excel 文件可以先用 [`@dou-ui/sheet-xlsx`](../sheet/xlsx) 读成工作簿，再用 `@dou-ui/sheet/core` 的 `sheetToCSV` 转成 CSV：

```ts
import { readXlsx } from '@dou-ui/sheet-xlsx'
import { sheetToCSV } from '@dou-ui/sheet/core'

const { book } = await readXlsx(file, { formulas: false })
gantt.value.importCSV(sheetToCSV(book.sheets[0]))
```

`formulas: false` 读入文件里存的计算结果，不读公式；`sheetToCSV` 默认写值，日期是 `2026-03-02` 的写法，不受单元格格式影响。

## API

### GanttCSVImportOptions

| 名称   | 说明                                                  | 类型                    | 默认值      |
| ------ | ----------------------------------------------------- | ----------------------- | ----------- |
| `mode` | `replace` 用文件替换现有任务，`append` 把任务加到最后 | `'replace' \| 'append'` | `'replace'` |

### GanttCSVResult

| 名称             | 说明                                                                                               | 类型                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `tasks`          | 读出的任务，按文件里的顺序                                                                         | `GanttTask[]`                                     |
| `warnings`       | 读不出的值：行号（表头是第 1 行）、字段或列的 `key` 和原文。这些值不会写入，已有的任务保留原来的值 | `{ row: number, column: string, text: string }[]` |
| `columns`        | 文件里有哪些列，按字段或列的 `key`；ID 两列是 `id`、`parent`                                       | `string[]`                                        |
| `unknownColumns` | 认不出的表头，这些列的值不会读取                                                                   | `string[]`                                        |

### GanttCSVError

文件里没有任务名称一列时，`importCSV` 和 `readCSV` 都抛出 `GanttCSVError`：

| 名称      | 说明                       | 类型              |
| --------- | -------------------------- | ----------------- |
| `code`    | 原因                       | `'noTitleColumn'` |
| `reason`  | 给用户看的说明，跟随语言包 | `string`          |
| `message` | 给开发者的说明             | `string`          |
