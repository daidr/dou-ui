# 导出与打印

甘特图可以导出成 SVG、PNG 或 CSV，也可以打印。导出的内容和屏幕上一致，颜色跟随当前的亮暗主题。

## 基础用法

<DocDemo src="gantt/export" column />

ref 上有四个方法：

- `exportSVG(options?)`：返回 SVG 文档字符串，可以在设计软件里继续编辑；
- `exportPNG(options?)`：返回 PNG 的 `Blob`，默认按 2 倍像素绘制；
- `toCSV(options?)`：返回 CSV 字符串，包含表格的每一列和每个任务，收起的子任务也在内；
- `print(options?)`：打开浏览器的打印对话框。

方法只返回内容，下载由你决定，可以用 `dou-ui` 的 [`downloadBlob`](../guide/composables#downloadblob)：

```ts
import { downloadBlob } from 'dou-ui'

downloadBlob(await gantt.value.exportPNG(), '排期.png')
```

排期本身需要保存时，直接把 `v-model` 的数据序列化成 JSON 即可。

## 图片

`range: 'all'`（默认）导出全部行和全部任务所在的时间，`'view'` 只导出当前看到的行和时间。`table` 决定是否画出左侧表格，默认跟随当前是否显示；`scale` 指定按哪个刻度绘制。`background: false` 时为透明底，便于放到其他背景上。

时间跨度很长时，导出的图片最宽 16000px，超出时会自动缩小刻度。

浏览器对画布的尺寸有限制：每边 16384 像素，总像素数在 iPhone 和 iPad 上约 1677 万，其他设备上是 16384 × 16384。图片很大时 `exportPNG()` 会自动降低 `pixelRatio`，降到 1 仍然放不下时会抛出 `RangeError`，不会生成一张模糊的图。行很多时最容易遇到，这时可以：

- 用 `range: 'view'` 分几次导出；
- 换成更粗的 `scale`；
- 改用 `exportSVG()` 或 `toCSV()`。

## CSV

CSV 默认写入表格软件能排序和计算的值：

- 日期是 `2026-03-02`，带时间的任务是 `2026-03-02 09:30`；
- 工期是工作日数，带时间的任务是工作小时数，表头会写上单位，如“工期（天）”；两种任务都有时，工期保留单位，如 `5 天`、`2 小时`；
- 进度是 0–100 的数字。

以 `=`、`+`、`-`、`@`、制表符或回车开头的文字（如任务名“-复盘”）前面会加上 `'`，表格软件打开时不会当成公式执行，导入时会去掉这个 `'`；数字不受影响。

`toCSV({ ids: true })` 在最前面加上“ID”和“上级任务 ID”两列，[导入](./import)时可以按 ID 更新原来的任务。`toCSV({ text: true })` 写入表格里显示的文字，如 `3月2日`、`5 天`，这样的文件不能再导入。

## 打印

`print()` 打印所有行，按纸张宽度自动选择刻度，行多时分成多页，每页都重复表头。

- `orientation` 是 `landscape`（横向，默认）或 `portrait`（纵向）；
- `table` 默认为 `true`：纸张放得下表格，即使窄屏上表格已经收起。

## API

### GanttExportOptions

`exportSVG` 的选项：

| 名称         | 说明                                                            | 类型              | 默认值           |
| ------------ | --------------------------------------------------------------- | ----------------- | ---------------- |
| `range`      | `all` 是全部行和全部任务所在的时间，`view` 是当前看到的行和时间 | `'all' \| 'view'` | `'all'`          |
| `table`      | 是否画出左侧表格                                                | `boolean`         | 跟随当前是否显示 |
| `scale`      | 按哪个刻度绘制，如 `'week'`                                     | `GanttScale`      | 当前的缩放       |
| `background` | 是否填充表头和行的底色                                          | `boolean`         | `true`           |

### GanttImageOptions

`exportPNG` 的选项，包含 `GanttExportOptions` 的全部字段，另外还有：

| 名称         | 说明                        | 类型     | 默认值 |
| ------------ | --------------------------- | -------- | ------ |
| `pixelRatio` | 每个 CSS 像素对应的图片像素 | `number` | `2`    |

### GanttCSVExportOptions

| 名称             | 说明                                       | 类型      | 默认值  |
| ---------------- | ------------------------------------------ | --------- | ------- |
| `text`           | 写入表格里显示的文字；这样的文件不能再导入 | `boolean` | `false` |
| `bom`            | 在开头加上 BOM，表格软件才会按 UTF-8 读取  | `boolean` | `true`  |
| `ids`            | 在最前面加上“ID”和“上级任务 ID”两列        | `boolean` | `false` |
| `escapeFormulas` | 在会被表格软件当成公式的文字前加 `'`       | `boolean` | `true`  |

### GanttPrintOptions

| 名称          | 说明             | 类型                        | 默认值        |
| ------------- | ---------------- | --------------------------- | ------------- |
| `orientation` | 纸张方向         | `'landscape' \| 'portrait'` | `'landscape'` |
| `table`       | 是否打印左侧表格 | `boolean`                   | `true`        |
