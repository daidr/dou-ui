---
wide: true
---

# 导出与打印

格子的数据可以导出成表格文件，整个仪表盘可以导出成 PNG 图片或打印。

## 基础用法

传入 `exporters` 后，表格、图表和透视表格子的标题栏会多出一个“导出”按钮（编辑时在格子菜单里），选一种文件就会下载这个格子的数据。

<DocDemo src="dashboard/export" />

## 导出格子的数据

`exporters` 是电子表格的导出器，文件名和工作表名取格子的标题。导出器来自 `@dou-ui/sheet`（`csvExporter`）和 `@dou-ui/sheet-xlsx`（`xlsxExporter`），也可以用自己写的，写法见电子表格的[导出器与导入器](../sheet/exporters)。在代码里导入它们时，需要另外安装 `@dou-ui/sheet` 和 `@dou-ui/sheet-xlsx`：

```vue
<script setup>
import { csvExporter } from '@dou-ui/sheet/core'
import { xlsxExporter } from '@dou-ui/sheet-xlsx'

const exporters = [xlsxExporter, csvExporter]
</script>

<template>
  <DouDashboard v-model="doc" :widgets="widgets" :sources="sources" :exporters="exporters" />
</template>
```

导出的是格子拿到的全部数据，不受格子大小和滚动的限制：

- 表格：一行表头，之后每条数据一行，数字不带千位分隔，日期写成 `2026-10-05`。
- 图表：横轴一列，每个系列一列，表头用 `labels` 里的名字。还没选横轴或系列的图表没有导出按钮。
- 透视表：和屏幕上一样，表头合并并冻结，数字带格式，折叠的组只有一行。

导出时会先等格子的数据加载完；离视口较远、还没绘制的格子会先画出来。导出期间按钮显示加载中，不会重复导出。失败时格子内容上方显示原因，可以关闭。

导出文件的代码在第一次传入 `exporters` 时单独加载，不传时不会加载。画出表格样子的导出器（如 PNG）不会出现在菜单里。

### 自己的格子类型

自己写的格子类型调用 `useDashboardWidget()` 的 `setWorkbook` 交出数据，就会有导出按钮。它收到一个函数，导出时才调用，返回电子表格的工作簿；工作表没写名字时用格子的标题。函数返回 `undefined` 时导出失败，提示“没有可导出的数据”；传 `null` 会去掉导出按钮，比如格子还没设置好时：

```ts
const { props, setWorkbook } = useDashboardWidget()

watch(
  () => !!props.value.field,
  (ready) =>
    setWorkbook(
      ready
        ? () => ({ version: 1, sheets: [{ name: '', cells: [['城市', '人数'], ...rows.value] }] })
        : null,
    ),
  { immediate: true },
)
```

### 在代码里导出

实例的 `saveWidget(id, exporter, options?)` 和菜单一样导出并下载，`exporter` 是 `exporters` 里的名字或导出器本身；`options.fileName` 指定文件名，默认是格子的标题加扩展名。失败时格子上显示原因、触发 `exportError`，返回的 Promise 也会 reject。调用 `event.preventDefault()` 可以不显示，改为自己提示，读屏仍会读出原因。

只需要文件内容时用 `exportWidget(id, exporter, options?)`，它返回 `Promise<Blob>`，不下载、不提示。两者的 `options.options` 是导出器自己的选项，类型按导出器推断，比如 CSV 的 `{ bom: false }`；`options.signal` 用来取消。格子没有交出数据时，两者都以 `SheetFileError` 失败，`code` 是 `'empty'`。

## 导出图片与打印

`exportPNG()` 把整个仪表盘导出为 PNG，`print()` 打开浏览器的打印对话框。两者都会先绘制所有格子（包括离视口较远、还没绘制的），等数据加载完成（最多 5 秒），并去掉菜单、按钮等控件。`exportPNG()` 只返回图片，下载成文件可以用 `dou-ui` 的 [`downloadBlob`](../guide/composables#downloadblob)：

```ts
import { downloadBlob } from 'dou-ui'

downloadBlob(await dashboard.value.exportPNG({ pixelRatio: 2 }), '仪表盘.png')
```

图片按格子在页面上的样子绘制，格子里的图表、迷你图等 canvas 一并导出；来自其他域名、没有允许跨域的图片无法读取，会留空。直接用浏览器菜单打印时也会隐藏控件，但只来得及绘制已经取到数据的格子，所以最好调用 `print()`。

导出和打印都只包含每个格子当前能看到的部分：透视表、明细表等在格子里滚动的内容，超出格子的行和列不会出现。需要完整数据时，请用上面的[导出格子的数据](#导出格子的数据)。

浏览器对画布的尺寸有限制：每边 16384 像素，总像素数在 iPhone 和 iPad 上约 1677 万，其他设备上是 16384 × 16384。图片很大时 `exportPNG()` 会自动降低 `pixelRatio`，降到 1 仍然放不下时会抛出 `RangeError`，不会生成一张模糊的图。仪表盘很长时可能遇到，这时可以改用 `print()`，打印会分页。

## API

### Dashboard Props

| 名称        | 说明                                         | 类型                       | 默认值 |
| ----------- | -------------------------------------------- | -------------------------- | ------ |
| `exporters` | 格子数据能导出成的文件类型，电子表格的导出器 | `readonly SheetExporter[]` | —      |

### Dashboard Events

| 名称          | 说明                                                         | 参数                                 |
| ------------- | ------------------------------------------------------------ | ------------------------------------ |
| `exportError` | 从菜单或 `saveWidget` 导出失败时；默认在格子内容上方显示原因 | `(event: DashboardExportErrorEvent)` |

### Dashboard Exposes

`exportWidget`、`saveWidget` 的 `exporter` 是 `exporters` 里的名字或导出器本身，`options.options` 的类型按导出器推断。

| 名称           | 说明                                       | 类型                                                                                                 |
| -------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `exportPNG`    | 导出为 PNG                                 | `(options?: DashboardImageOptions) => Promise<Blob>`                                                 |
| `exportWidget` | 用导出器导出格子的数据，不下载、不提示     | `(id: string, exporter: string \| SheetExporter, options?: DashboardExportOptions) => Promise<Blob>` |
| `saveWidget`   | 导出格子的数据并下载，失败时提示           | `(id: string, exporter: string \| SheetExporter, options?: DashboardSaveOptions) => Promise<void>`   |
| `print`        | 绘制所有格子、等数据加载完后打开打印对话框 | `() => Promise<void>`                                                                                |

### DashboardImageOptions

| 名称         | 说明                        | 类型      | 默认值 |
| ------------ | --------------------------- | --------- | ------ |
| `pixelRatio` | 每个 CSS 像素对应的图片像素 | `number`  | `2`    |
| `background` | 用页面背景色填充            | `boolean` | `true` |
| `padding`    | 四周留白（px）              | `number`  | `16`   |

### DashboardExportOptions / DashboardSaveOptions

`DashboardSaveOptions` 包含 `DashboardExportOptions` 的全部字段，另外还有 `fileName`。

| 名称       | 说明                                         | 类型          | 默认值           |
| ---------- | -------------------------------------------- | ------------- | ---------------- |
| `options`  | 导出器自己的选项，如 CSV 的 `{ bom: false }` | 按导出器推断  | —                |
| `signal`   | 取消导出                                     | `AbortSignal` | —                |
| `fileName` | 仅 `saveWidget`：文件名，带扩展名            | `string`      | 格子标题加扩展名 |

### DashboardExportErrorEvent

| 名称               | 说明                             | 类型         |
| ------------------ | -------------------------------- | ------------ |
| `widget`           | 格子的 id                        | `string`     |
| `exporter`         | 导出器的名字                     | `string`     |
| `error`            | 出错的原因                       | `unknown`    |
| `message`          | 默认显示在格子上方的文字         | `string`     |
| `defaultPrevented` | 是否已调用 `preventDefault()`    | `boolean`    |
| `preventDefault`   | 不显示默认的提示，由应用自己提示 | `() => void` |

### useDashboardWidget

| 名称          | 说明                                                                           | 类型                                                        |
| ------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `setWorkbook` | 交出格子的数据，供导出使用；`get` 返回电子表格的工作簿，传 `null` 去掉导出按钮 | `(get: (() => SheetWorkbook \| undefined) \| null) => void` |
