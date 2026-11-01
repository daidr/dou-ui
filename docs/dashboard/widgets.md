# 内置格子

`@dou-ui/dashboard` 提供几种常用的格子类型，设置面板都已经写好，可以直接注册，也可以和自己写的格子类型放在一起。

<DocDemo src="dashboard/builtin" />

打开“编辑”后，在格子菜单里打开设置，可以换数据源、选字段。点柱状图里的一根柱子，或者透视表里的一个单元格，会筛选其他格子。

## 注册

内置格子按入口分开，没用到的不会打进包里：

```ts
import { statWidget, tableWidget, textWidget } from '@dou-ui/dashboard/widgets'
import { chartWidget } from '@dou-ui/dashboard/chart' // 需要 @dou-ui/chart
import { pivotWidget } from '@dou-ui/dashboard/pivot' // 需要 @dou-ui/pivot

const widgets = [statWidget(), textWidget(), tableWidget(), chartWidget(), pivotWidget()]
```

每个函数都可以传入要改的部分，例如 `statWidget({ type: 'kpi', label: '指标', size: { w: 2, h: 2 } })`。内置格子都带有图标，显示在添加格子的面板里，也可以用 `icon` 换成别的。图表和透视表格子还需要引入它们自己的样式：和全量的 `dou-ui/style.css` 一起用时引入 `@dou-ui/chart/style.css`、`@dou-ui/pivot/style.css`；按需引入时引入 `@dou-ui/chart/style`、`@dou-ui/pivot/style`，它们会带上用到的 `dou-ui` 组件样式。

下面各类型的设置都保存在格子的 `props` 里，是普通的 JSON。字段名写成 `total.amount` 这样的路径时，按层级读取数据。

## 统计数字

`statWidget()`，类型 `stat`。显示一个数字，可以带变化率和迷你图。

| 设置        | 说明                                                  |
| ----------- | ----------------------------------------------------- |
| `source`    | 数据源；不填时显示 `value`                            |
| `field`     | 数字所在的字段                                        |
| `value`     | 没有数据源时显示的数字                                |
| `prefix`    | 前缀，例如 `¥`                                        |
| `suffix`    | 后缀，例如 `单`                                       |
| `precision` | 小数位数                                              |
| `trend`     | 一组数字所在的字段，画成数字下方的迷你图              |
| `delta`     | 变化率所在的字段，`0.125` 显示为“较上期 +12.5%”和箭头 |

## 文字

`textWidget()`，类型 `text`。显示一段文字，保留换行。

| 设置   | 说明                            |
| ------ | ------------------------------- |
| `text` | 文字                            |
| `size` | `'sm'`、`'md'`（默认）或 `'lg'` |

## 表格

`tableWidget()`，类型 `table`。把数据源的行显示成表格，超过 100 行时只绘制可见的部分。

| 设置      | 说明                                                             |
| --------- | ---------------------------------------------------------------- |
| `source`  | 数据源                                                           |
| `path`    | 行所在的字段，数据本身就是数组时不填                             |
| `columns` | 显示的列 `{ key, title? }[]`，按顺序；不填时显示第一行的全部字段 |

数字列自动右对齐。

## 图表

`chartWidget()`，类型 `chart`，用 `@dou-ui/chart` 绘制。

| 设置         | 说明                                                      |
| ------------ | --------------------------------------------------------- |
| `source`     | 数据源                                                    |
| `path`       | 行所在的字段                                              |
| `kind`       | `'line'`（默认）、`'area'`、`'bar'` 或 `'pie'`            |
| `x`          | 分类或时间所在的字段；饼图是每一块的名字                  |
| `y`          | 要画的数值字段，每个一条序列；饼图只用第一个              |
| `labels`     | 字段在图例和提示里显示的名字，例如 `{ amount: '销售额' }` |
| `stacked`    | 面积图、柱状图堆叠                                        |
| `horizontal` | 横向柱状图                                                |
| `filter`     | 点击一个分类时，用这个筛选名筛选其他格子；再点一次取消    |

设置了 `filter` 的柱状图，选中一根柱子后其他柱子变成灰色。日期会转成 `YYYY-MM-DD` 文字再作为筛选值。

## 透视表

`pivotWidget()`，类型 `pivot`，用 `@dou-ui/pivot` 绘制。设置面板里用透视表的字段面板摆放行、列和值。

| 设置     | 说明                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| `source` | 数据源                                                                                           |
| `path`   | 记录所在的字段                                                                                   |
| `config` | 行、列和值，同 `DouPivot` 的 `config`                                                            |
| `filter` | 设为 `true` 时，点击单元格按它所在的行、列分组筛选其他格子，每个字段一个筛选，并标出选中的行和列 |

字段的显示名和格式写在注册时，不保存在文档里：

```ts
pivotWidget({
  fields: [
    { name: 'region', label: '地区' },
    { name: 'amount', label: '销售额', format: { style: 'currency', currency: 'CNY' } },
  ],
})
```

在查看模式里点表头排序只在本次有效；编辑时的修改会保存到 `config`。

## 导出格子的数据

`exporters` 传入电子表格的导出器后，表格、图表和透视表格子的标题栏会多出一个“导出”按钮（编辑时在格子菜单里），选一种文件就会下载这个格子的数据，文件名和工作表名取格子的标题。导出器来自 `@dou-ui/sheet`（`csvExporter`）和 `@dou-ui/sheet-xlsx`（`xlsxExporter`），也可以用自己写的，写法见电子表格的[导出器与导入器](../sheet/extensions#导出器与导入器)。在代码里导入它们时，需要另外安装 `@dou-ui/sheet` 和 `@dou-ui/sheet-xlsx`：

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

<DocDemo src="dashboard/export" />

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
      ready ? () => ({ sheets: [{ name: '', cells: [['城市', '人数'], ...rows.value] }] }) : null,
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

| 选项         | 说明                      | 默认值 |
| ------------ | ------------------------- | ------ |
| `pixelRatio` | 每个 CSS 像素对应的像素数 | `2`    |
| `background` | 用页面背景色填充          | `true` |
| `padding`    | 四周留白（px）            | `16`   |

图片按格子在页面上的样子绘制，格子里的图表、迷你图等 canvas 一并导出；来自其他域名、没有允许跨域的图片无法读取，会留空。直接用浏览器菜单打印时也会隐藏控件，但只来得及绘制已经取到数据的格子，所以最好调用 `print()`。

导出和打印都只包含每个格子当前能看到的部分：透视表、明细表等在格子里滚动的内容，超出格子的行和列不会出现。需要完整数据时，请用上面的[导出格子的数据](#导出格子的数据)。

浏览器对画布的尺寸有限制（每边 16384 像素；总像素数在 iPhone 和 iPad 上约 1677 万，其他设备上是 16384 × 16384），图片很大时 `exportPNG()` 会自动降低 `pixelRatio`，降到 1 仍然放不下时会抛出 `RangeError`，不会生成一张模糊的图。仪表盘很长时可能遇到，这时可以改用 `print()`，打印会分页。

## API

### Dashboard Props

| 名称        | 说明                                         | 类型              | 默认值 |
| ----------- | -------------------------------------------- | ----------------- | ------ |
| `exporters` | 格子数据能导出成的文件类型，电子表格的导出器 | `SheetExporter[]` | —      |

### Dashboard Events

| 名称          | 说明                                                         | 参数                                                                       |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `exportError` | 从菜单或 `saveWidget` 导出失败时；默认在格子内容上方显示原因 | `{ widget, exporter, error, message, defaultPrevented, preventDefault() }` |

### Dashboard Exposes

| 名称                                   | 说明                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `exportPNG(options?)`                  | 导出为 PNG，返回 `Promise<Blob>`                                               |
| `exportWidget(id, exporter, options?)` | 用导出器导出格子的数据，返回 `Promise<Blob>`；`options` 有 `options`、`signal` |
| `saveWidget(id, exporter, options?)`   | 导出格子的数据并下载，失败时提示；`options` 另有 `fileName`                    |
| `print()`                              | 绘制所有格子、等数据加载完后打开打印对话框                                     |

### useDashboardWidget

| 名称               | 说明                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `sources`          | 仪表盘里数据源的名字，用于设置面板里选择                                                   |
| `setWorkbook(get)` | 交出格子的数据，供标题栏的导出按钮使用；`get` 返回电子表格的工作簿，传 `null` 去掉导出按钮 |
