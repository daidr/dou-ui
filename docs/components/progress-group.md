# ProgressGroup 分段进度

在一条进度条中按占比显示多个部分，例如存储空间的分类用量。

## 基础用法

`items` 的每一项是一段，`value` 是它的数量。`legend` 在下方列出每一段，`format` 决定数量的写法，默认是百分比。悬停某一段时显示它的名称和数量。

<DocDemo src="progress-group/basic" column />

## 总量与颜色

不传 `max` 时以各段之和为总量，各段正好填满整条。没有指定 `tone` 或 `color` 的段依次使用 primary、success、warning、danger、neutral。

<DocDemo src="progress-group/fill" column />

## 竖排图例

`legend-direction="vertical"` 让图例每项占一行，名称在前，数量靠右对齐，适合放在卡片或侧栏这类较窄的地方，便于上下对照各项的数量。名称太长时以省略号结尾。默认的 `horizontal` 让各项并排，放不下时换行。

<DocDemo src="progress-group/vertical" column />

## 可访问性

整体是 `role="group"`，可以用 `label` 命名；每一段是 `role="meter"`，读出名称和 `format` 后的数量。

## API

### Props

| 名称              | 说明                       | 类型                                         | 默认值         |
| ----------------- | -------------------------- | -------------------------------------------- | -------------- |
| `items`           | 各段                       | `ProgressGroupItem[]`                        | `[]`           |
| `max`             | 总量                       | `number`                                     | 各段之和       |
| `size`            | 粗细：4、6、8px            | `'sm' \| 'md' \| 'lg'`                       | `'md'`         |
| `legend`          | 显示图例                   | `boolean`                                    | `false`        |
| `legendDirection` | 图例的排列：并排或每项一行 | `'horizontal' \| 'vertical'`                 | `'horizontal'` |
| `tooltip`         | 悬停时显示名称和数量       | `boolean`                                    | `true`         |
| `format`          | 数量的写法                 | `(value: number, percent: number) => string` | 百分比         |
| `label`           | 无可见标签时给读屏的名称   | `string`                                     | —              |

### ProgressGroupItem

| 名称    | 说明                      | 类型     |
| ------- | ------------------------- | -------- |
| `value` | 数量                      | `number` |
| `label` | 名称                      | `string` |
| `tone`  | 语气色                    | `Tone`   |
| `color` | 自定义颜色，优先于 `tone` | `string` |

### Slots

| 名称     | 说明           | 参数                                                         |
| -------- | -------------- | ------------------------------------------------------------ |
| `legend` | 替换图例的文字 | `{ item: ProgressGroupItem; percent: number; text: string }` |
