# 甘特图

`@dou-ui/gantt` 提供甘特图 `DouGantt`：左边是任务表格，右边是时间轴上的任务条，任务之间可以有依赖。适合项目排期、迭代计划这类有起止时间和前后关系的任务。

## 安装

甘特图是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/gantt
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/gantt/style.css'
import { DouGantt } from '@dou-ui/gantt'

app.use(DouGantt)
```

## 基础用法

`v-model` 绑定一份排期，里面的 `tasks` 是任务列表，`links` 是任务之间的依赖，格式见[文档数据](./data)。

<DocDemo src="gantt/basic" column />

- 有子任务的任务是汇总任务，它的起止时间和进度由子任务算出；
- `type: 'milestone'` 的任务是里程碑，画成一个菱形；
- 不设置 `readonly` 时可以直接拖动编辑，见[编辑](./editing)。

## 表格与任务条

`columns` 设置左侧表格的列，默认是名称、开始和工期，写法见[列](./data#列)。`tableWidth` 是表格的初始宽度，`rowHeight` 是行高。

`barLabel` 决定任务名放在哪里：

- `auto`（默认）：放得下时在任务条内，否则在任务条旁；
- `inside`、`outside`：总是在条内或条旁；
- `none`：不显示。

`bar` 插槽可以替换任务条里的内容，`cell` 插槽可以替换表格的单元格。

## 窄屏

宽度小于 520px 时表格自动收起，只显示时间轴。任务名显示在任务条上或旁边；任务条不在视野里的行，任务名固定显示在时间轴左侧。也可以用 `:table="false"` 主动隐藏表格。

## 语言

甘特图里的文字（表头、菜单、提示、读屏播报等）跟随 [ConfigProvider](/components/config-provider) 的语言，内置简体中文、繁体中文和英文。

`messages` 可以改写其中几条，只需写要改的部分。`ganttLocales` 是内置的三份文案，按语言名称索引；`useGanttMessages(override?)` 返回当前语言的文案，在扩展或插槽里需要相同的文字时使用。

## API

### Gantt Props

| 名称                | 说明                                                                                                   | 类型                                                                                         | 默认值                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| `v-model`           | 排期：任务和依赖，见[文档数据](./data)                                                                 | `GanttDocument`                                                                              | `{ version: 1, tasks: [], links: [] }` |
| `v-model:selection` | 选中的任务 id                                                                                          | `string[]`                                                                                   | `[]`                                   |
| `v-model:scale`     | 时间刻度，见[时间轴](./timeline#时间刻度)                                                              | `GanttScale`                                                                                 | 按内容自动选择                         |
| `columns`           | 表格的列，见[列](./data#列)                                                                            | `GanttColumn[]`                                                                              | 名称、开始、工期                       |
| `table`             | 显示左侧的表格；窄于 520px 时自动收起                                                                  | `boolean`                                                                                    | `true`                                 |
| `tableWidth`        | 表格的初始宽度（px）                                                                                   | `number`                                                                                     | `360`                                  |
| `rowHeight`         | 行高（px）                                                                                             | `number`                                                                                     | `36`                                   |
| `barLabel`          | 任务名放在哪里：`auto` 放得下时在条内，否则在条旁                                                      | `'auto' \| 'inside' \| 'outside' \| 'none'`                                                  | `'auto'`                               |
| `range`             | 固定时间轴的范围；不设时两端随滚动延伸                                                                 | `[string, string]`                                                                           | —                                      |
| `today`             | 显示当前时间线                                                                                         | `boolean`                                                                                    | `true`                                 |
| `weekStart`         | 一周的第一天：`0` 周日，`1` 周一                                                                       | `0 \| 1`                                                                                     | 跟随语言                               |
| `calendar`          | 工作日历，见[工作日历](./timeline#工作日历)                                                            | `GanttCalendar`                                                                              | —                                      |
| `scheduling`        | `manual` 只改动拖动的任务；`auto` 同时把后续任务往后推，见[自动排期](./scheduling)                     | `'manual' \| 'auto'`                                                                         | `'manual'`                             |
| `critical`          | 高亮关键路径，见[关键路径](./scheduling#关键路径)                                                      | `boolean`                                                                                    | `false`                                |
| `markers`           | 标记线，见[标记线](./markers#标记线)                                                                   | `GanttMarker[]`                                                                              | —                                      |
| `baseline`          | 基线，见[基线](./markers#基线)                                                                         | `GanttBaselineItem[]`                                                                        | —                                      |
| `addRow`            | 可编辑时在表格最下方显示添加任务的一行                                                                 | `boolean`                                                                                    | `true`                                 |
| `menu`              | 显示内置的菜单项，见[右键菜单](./menu)                                                                 | `boolean`                                                                                    | `true`                                 |
| `contextMenu`       | 自己的菜单项，排在最前面                                                                               | `(target: GanttMenuTarget) => ContextMenuItem[]`                                             | —                                      |
| `canLink`           | 连依赖前的最后一道检查，返回 `true` 允许，返回字符串时显示为原因，见[依赖的限制](./editing#依赖的限制) | `(link: Pick<GanttLink, 'from' \| 'to' \| 'type'>, doc: GanttDocument) => boolean \| string` | —                                      |
| `canMove`           | 写入新的时间前的最后一道检查，见[移动的限制](./editing#移动的限制)                                     | `(move: GanttMove, doc: GanttDocument) => boolean \| string`                                 | —                                      |
| `readonly`          | 只读：不能拖动、连线和在表格里编辑，撤销重做的快捷键也不响应；代码调用 `transact` 仍然生效             | `boolean`                                                                                    | `false`                                |
| `extensions`        | 扩展，见[扩展](./extensions)                                                                           | `(GanttExtension \| GanttExtension[])[]`                                                     | —                                      |
| `ariaLabel`         | 甘特图的无障碍名称                                                                                     | `string`                                                                                     | —                                      |
| `messages`          | 覆盖文案，只需写要改的部分                                                                             | `GanttMessagesOverride`                                                                      | —                                      |

### Gantt Events

| 名称                         | 说明                                                                                  | 参数                                   |
| ---------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| `transaction`                | 每次修改后触发，包括撤销和重做，在 `v-model` 更新之后，见[用代码修改](./transactions) | `(tr: GanttTransaction)`               |
| `transactionCancel`          | 修改被扩展[取消](./extensions#取消修改)时触发                                         | `(tr: GanttTransaction)`               |
| `link`                       | 拖动连好一条依赖                                                                      | `(link: GanttLink)`                    |
| `taskClick` / `taskDblclick` | 点击、双击任务                                                                        | `(task: GanttTask, event: MouseEvent)` |
| `taskContextmenu`            | 在任务上打开菜单前触发，`event.preventDefault()` 可以不打开                           | `(task: GanttTask, event: MouseEvent)` |
| `linkClick`                  | 点击依赖线                                                                            | `(link: GanttLink, event: MouseEvent)` |
| `linkContextmenu`            | 在依赖线上打开菜单前触发，`event.preventDefault()` 可以不打开                         | `(link: GanttLink, event: MouseEvent)` |

### Gantt Slots

| 名称      | 说明                                                | 参数                          |
| --------- | --------------------------------------------------- | ----------------------------- |
| `cell`    | 表格的单元格                                        | `{ task, row, column, text }` |
| `bar`     | 任务条里的内容，替换任务名                          | `{ task, row }`               |
| `default` | 画在甘特图上面的内容，比如面板，可以用 `useGantt()` | —                             |

### Gantt Exposes

| 名称                         | 说明                                                                          | 类型                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `transact`                   | 在一个事务里修改，算作一步撤销                                                | `(fn: (tr) => void, meta?) => GanttTransaction`                             |
| `undo` / `redo`              | 撤销、重做                                                                    | `() => boolean`                                                             |
| `canUndo` / `canRedo`        | 能否撤销、重做                                                                | `boolean`                                                                   |
| `schedule`                   | 移动任务让所有依赖都满足，算作一步撤销；只往后推，`pull` 为 `true` 时也往前拉 | `(options?: { pull?: boolean }) => GanttSchedule`                           |
| `insertTask`                 | 在某个任务之后（或里面）添加一个任务并开始编辑名称，返回它的 id               | `(near: string \| null, options?: GanttInsertOptions) => string`            |
| `indentTask` / `outdentTask` | 缩进、取消缩进                                                                | `(id: string) => boolean`                                                   |
| `editCell`                   | 开始编辑表格的单元格，默认名称；不能编辑时返回 `false`                        | `(id: string, key?: string) => boolean`                                     |
| `fit`                        | 选一个能放下全部任务的日宽，并滚动到第一个任务                                | `() => void`                                                                |
| `scrollToDate`               | 滚动到某个时间                                                                | `(date: string) => void`                                                    |
| `scrollToToday`              | 滚动到现在                                                                    | `() => void`                                                                |
| `scrollToTask`               | 滚动到某个任务                                                                | `(id: string) => void`                                                      |
| `focusTask`                  | 让键盘停在某个任务上，滚动到它并聚焦任务条                                    | `(id: string) => void`                                                      |
| `zoomIn` / `zoomOut`         | 放大、缩小时间轴，视图中间的时间不动                                          | `() => void`                                                                |
| `exportSVG`                  | 导出 SVG 文本，见[导出与打印](./export)                                       | `(options?: GanttExportOptions) => string`                                  |
| `exportPNG`                  | 导出 PNG                                                                      | `(options?: GanttImageOptions) => Promise<Blob>`                            |
| `toCSV`                      | 导出 CSV 文本                                                                 | `(options?: GanttCSVExportOptions) => string`                               |
| `readCSV`                    | 读取 CSV 里的任务，不放进甘特图，见[导入](./import)                           | `(text: string) => GanttCSVResult`                                          |
| `importCSV`                  | 把 CSV 里的任务放进甘特图，一步撤销；只读时返回 `null`                        | `(text: string, options?: GanttCSVImportOptions) => GanttCSVResult \| null` |
| `print`                      | 打印全部行                                                                    | `(options?: GanttPrintOptions) => void`                                     |
