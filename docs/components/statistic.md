# Statistic 统计数值

展示统计数值，适合仪表盘、数据概览等场景。

## 基础用法

<DocDemo src="statistic/basic" style="gap: 48px" />

数字按三位分组（`group-separator`，传 `''` 关闭），`precision` 固定小数位数并四舍五入。`value` 为 `null` 时显示"—"，传字符串则原样显示。

## 趋势

`trend` 在数字前加一个箭头。默认"上升是好事"，上升为成功色、下降为危险色；对耗时、错误数这类越少越好的指标，设置 `:up-is-good="false"` 把颜色反过来。`footer` 插槽放在数字下方，适合写对比。

<DocDemo src="statistic/trend" style="gap: 48px" />

## 自定义格式与加载

`formatter` 把数字整个换成别的文字；`loading` 时用一条占位块代替数字，高度不变，数据回来时页面不跳。

<DocDemo src="statistic/format-loading" style="gap: 48px" />

## 大小

数字的字号来自 CSS 变量 `--dou-statistic-value-size`（默认 28px），前后缀和小数按比例缩小：

```vue
<DouStatistic style="--dou-statistic-value-size: 40px" title="今日订单" :value="1024" />
```

## API

### Statistic Props

| 名称               | 说明                         | 类型                        | 默认值  |
| ------------------ | ---------------------------- | --------------------------- | ------- |
| `title`            | 标签                         | `string`                    | —       |
| `value`            | 数值；字符串原样显示         | `number \| string \| null`  | —       |
| `precision`        | 小数位数                     | `number`                    | —       |
| `groupSeparator`   | 千分位分隔符                 | `string`                    | `','`   |
| `decimalSeparator` | 小数点                       | `string`                    | `'.'`   |
| `prefix`           | 前缀                         | `string`                    | —       |
| `suffix`           | 后缀                         | `string`                    | —       |
| `trend`            | 趋势箭头                     | `'up' \| 'down'`            | —       |
| `upIsGood`         | 上升是否是好事，决定箭头颜色 | `boolean`                   | `true`  |
| `formatter`        | 自定义格式                   | `(value: number) => string` | —       |
| `loading`          | 显示占位块                   | `boolean`                   | `false` |

### Statistic Slots

| 名称     | 说明         |
| -------- | ------------ |
| `title`  | 替换标签     |
| `prefix` | 替换前缀     |
| `suffix` | 替换后缀     |
| `footer` | 数字下方内容 |
