# 层级数据

`DouChartTreemap`（矩形树图）和 `DouChartSunburst`（旭日图）用于展示有层级的数据，看一个总数由哪些部分组成、哪些部分最大。两者都需要单独放在一个图表里，没有图例。

## 数据

数据是嵌套的行：每一行有名称和值，或者有自己的子行。

```ts
const data = [
  {
    name: '上海',
    children: [
      { name: '徐汇店', value: 320 },
      { name: '静安店', value: 280 },
    ],
  },
  { name: '杭州', value: 260 },
]
```

- `label`、`value`、`children` 指定名称、值和子行的字段，默认是 `name`、`value` 和 `children`。
- 有子行的节点，值是子行之和。
- 小于等于 0 的值不画。

## 矩形树图

矩形的面积和值成正比。

<DocDemo src="chart/treemap" />

- 每个矩形尽量接近正方形，大的排在前面。
- 第一层的节点依次使用色板里的彩色，下面的节点和它同色。
- 有子行的节点画成浅色的底，顶部写着名称，子节点排在下面。
- 放得下的矩形里写着名称，`:labels="false"` 去掉名称。

## 旭日图

旭日图用一圈圈的圆环画出同样的数据：第一层在最里面，每往下一层就往外一圈。每个节点在父节点的弧里所占的比例和值成正比，越往外颜色越淡。

<DocDemo src="chart/sunburst" />

- `innerRadius` 是中间空洞占半径的比例，默认 `0.3`，默认插槽的内容显示在空洞中间。
- 悬停在一个节点上时，不在它所在分支上的节点会变淡。

## 提示框与点击

- 提示框显示从第一层到这个节点的路径、值和占整体的比例。
- 方向键按顺序查看每个节点。数据表列出每个节点的路径、值和占比。
- 点击节点时，`select` 事件的 `x` 是节点的名称；同名的节点可以用 `title`（完整路径）或 `items[0].row`（节点自己的行）区分。

## API

### Treemap / Sunburst Props

| 名称          | 说明                                                                                    | 类型                                                                | 默认值        |
| ------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------- |
| `data`        | 第一层的行，每一行可以有子行                                                            | `object[]`                                                          | 图表的 `data` |
| `label`       | 每个节点的名称                                                                          | `string \| (row, index: number) => unknown`                         | `'name'`      |
| `value`       | 每个叶子节点的值                                                                        | `string \| (row, index: number) => unknown`                         | `'value'`     |
| `children`    | 每个节点的子行                                                                          | `string \| (row, index: number) => unknown`                         | `'children'`  |
| `name`        | 整体的名称，读屏时读在最前面                                                            | `string`                                                            | —             |
| `color`       | 每个节点的颜色：字段名，或行和层级的函数，得到 CSS 颜色或语气色；没有值时用父节点的颜色 | `string \| (row, depth: number) => string \| undefined`             | 色板的彩色    |
| `labels`      | 在放得下的节点里写出名称；也可以是返回文字的函数                                        | `boolean \| (label: ChartDataLabel) => string \| null \| undefined` | `true`        |
| `innerRadius` | 仅旭日图：中间空洞占半径的比例                                                          | `number`                                                            | `0.3`         |

### Sunburst Slots

| 名称      | 说明                   |
| --------- | ---------------------- |
| `default` | 显示在中间空洞里的内容 |
