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

- 每个函数都可以传入要改的部分，例如 `statWidget({ type: 'kpi', label: '指标', size: { w: 2, h: 2 } })`。
- 内置格子都带有图标，显示在添加格子的面板里，也可以用 `icon` 换成别的。
- 图表和透视表格子还需要引入它们自己的样式：和全量的 `dou-ui/style.css` 一起用时引入 `@dou-ui/chart/style.css`、`@dou-ui/pivot/style.css`；按需引入时引入 `@dou-ui/chart/style`、`@dou-ui/pivot/style`，它们会带上用到的 `dou-ui` 组件样式。

下面各类型的设置都保存在格子的 `props` 里，是普通的 JSON。字段名写成 `total.amount` 这样的路径时，按层级读取数据。`props` 常由程序或 AI 生成，类型不对的设置（比如该写字段路径的地方写了数字、`columns` 不是数组）按没有设置处理，不会报错；保存前最好按下面的类型自己校验一遍。

## 统计数字

`statWidget()`，类型 `stat`。显示一个数字，可以带变化率和迷你图。

| 设置        | 说明                                                  | 类型     | 默认值 |
| ----------- | ----------------------------------------------------- | -------- | ------ |
| `source`    | 数据源；不填时显示 `value`                            | `string` | —      |
| `field`     | 数字所在的字段                                        | `string` | —      |
| `value`     | 没有数据源时显示的数字                                | `number` | —      |
| `prefix`    | 前缀，例如 `¥`                                        | `string` | —      |
| `suffix`    | 后缀，例如 `单`                                       | `string` | —      |
| `precision` | 小数位数                                              | `number` | —      |
| `trend`     | 一组数字所在的字段，画成数字下方的迷你图              | `string` | —      |
| `delta`     | 变化率所在的字段，`0.125` 显示为“较上期 +12.5%”和箭头 | `string` | —      |

## 文字

`textWidget()`，类型 `text`。显示一段文字，保留换行。

| 设置   | 说明 | 类型                   | 默认值 |
| ------ | ---- | ---------------------- | ------ |
| `text` | 文字 | `string`               | —      |
| `size` | 字号 | `'sm' \| 'md' \| 'lg'` | `'md'` |

## 表格

`tableWidget()`，类型 `table`。把数据源的行显示成表格，超过 100 行时只绘制可见的部分。

| 设置      | 说明                                     | 类型                                | 默认值           |
| --------- | ---------------------------------------- | ----------------------------------- | ---------------- |
| `source`  | 数据源                                   | `string`                            | —                |
| `path`    | 行所在的字段，数据本身是数组时不填       | `string`                            | —                |
| `columns` | 显示的列，按顺序；`title` 不填时用 `key` | `{ key: string; title?: string }[]` | 第一行的全部字段 |
| `rowKey`  | 区分各行的字段                           | `string`                            | 行在数组里的位置 |

数字列自动右对齐。

## 图表

`chartWidget()`，类型 `chart`，用 `@dou-ui/chart` 绘制。

| 设置         | 说明                                                      | 类型                                 | 默认值   |
| ------------ | --------------------------------------------------------- | ------------------------------------ | -------- |
| `source`     | 数据源                                                    | `string`                             | —        |
| `path`       | 行所在的字段，数据本身是数组时不填                        | `string`                             | —        |
| `kind`       | 图表种类                                                  | `'line' \| 'area' \| 'bar' \| 'pie'` | `'line'` |
| `x`          | 分类或时间所在的字段；饼图是每一块的名字                  | `string`                             | —        |
| `y`          | 要画的数值字段，每个一条序列；饼图只用第一个              | `string[]`                           | —        |
| `labels`     | 字段在图例和提示里显示的名字，例如 `{ amount: '销售额' }` | `Record<string, string>`             | —        |
| `stacked`    | 面积图、柱状图堆叠                                        | `boolean`                            | `false`  |
| `horizontal` | 横向柱状图                                                | `boolean`                            | `false`  |
| `filter`     | 点击一个分类时，用这个筛选名筛选其他格子；再点一次取消    | `string`                             | —        |

设置了 `filter` 的柱状图，选中一根柱子后其他柱子变成灰色。日期会转成 `YYYY-MM-DD` 文字再作为筛选值。

## 透视表

`pivotWidget()`，类型 `pivot`，用 `@dou-ui/pivot` 绘制。设置面板里用透视表的字段面板摆放行、列和值。

| 设置     | 说明                                                                                             | 类型          | 默认值  |
| -------- | ------------------------------------------------------------------------------------------------ | ------------- | ------- |
| `source` | 数据源                                                                                           | `string`      | —       |
| `path`   | 记录所在的字段，数据本身是数组时不填                                                             | `string`      | —       |
| `config` | 行、列和值，同 `DouPivot` 的 `config`                                                            | `PivotConfig` | —       |
| `filter` | 设为 `true` 时，点击单元格按它所在的行、列分组筛选其他格子，每个字段一个筛选，并标出选中的行和列 | `boolean`     | `false` |

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

导出格子的数据见[导出与打印](./export)。

## API

### 函数

每个函数都返回一个 `DashboardWidgetType`，`overrides` 可以改掉除 `component` 以外的任何字段，见[自定义格子](./custom-widgets#dashboardwidgettype)。

| 名称                      | 入口                        | 类型                                                                     |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `statWidget(overrides?)`  | `@dou-ui/dashboard/widgets` | `(overrides?: WidgetOverrides<StatWidgetProps>) => DashboardWidgetType`  |
| `textWidget(overrides?)`  | `@dou-ui/dashboard/widgets` | `(overrides?: WidgetOverrides<TextWidgetProps>) => DashboardWidgetType`  |
| `tableWidget(overrides?)` | `@dou-ui/dashboard/widgets` | `(overrides?: WidgetOverrides<TableWidgetProps>) => DashboardWidgetType` |
| `chartWidget(overrides?)` | `@dou-ui/dashboard/chart`   | `(overrides?: WidgetOverrides<ChartWidgetProps>) => DashboardWidgetType` |
| `pivotWidget(options?)`   | `@dou-ui/dashboard/pivot`   | `(options?: PivotWidgetOptions) => DashboardWidgetType`                  |

`PivotWidgetOptions` 另有 `fields?: readonly PivotField[]`，是透视表字段的显示名和格式，同 `DouPivot` 的 `fields`；不给时按记录推断。

### useDashboardWidget

设置面板里常用的字段：

| 名称      | 说明                                     | 类型                    |
| --------- | ---------------------------------------- | ----------------------- |
| `sources` | 仪表盘里数据源的名字，用于设置面板里选择 | `ComputedRef<string[]>` |
