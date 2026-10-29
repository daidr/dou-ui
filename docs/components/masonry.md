# Masonry 瀑布流

把高度不一的卡片排成几列，每一项放进当前最矮的一列。

## 基础用法

`items` 传入数据，默认插槽渲染每一项，参数为 `{ item, index }`。`item-key` 指定每项的唯一键，默认使用下标。`columns` 设定列数，可以按[断点](../guide/breakpoints)取值；`gap` 与 [Grid](./grid) 相同，取 `sm` / `md` / `lg` 或任意 CSS 长度，传一对值分别设置行距和列距。

<DocDemo src="masonry/basic" column />

## 加载更多

配合 [InfiniteScroll](./infinite-scroll) 使用，新加入的项接着放进最矮的列，已经排好的项位置不变。

<DocDemo src="masonry/infinite" column />

## 排布方式

- 每一项的高度由 `ResizeObserver` 测量。图片加载完成、文字换行等引起高度变化时，会重新排布。
- 排布前（包括服务端渲染的结果），各项按普通的等宽网格排列，测量后再移到各自的列中。
- 页面中元素的顺序始终与 `items` 的顺序相同，所以 `Tab` 键和读屏软件按数据原来的顺序访问，不按列的顺序。
- 组件无法检测到的变化（例如修改了某项内部的样式）可以调用实例的 `relayout()` 重新排布。

## API

### Masonry Props

| 名称      | 说明                                 | 类型                                                       | 默认值 |
| --------- | ------------------------------------ | ---------------------------------------------------------- | ------ |
| `items`   | 数据，按阅读顺序排列                 | `T[]`                                                      | —      |
| `columns` | 列数                                 | `Responsive<number>`                                       | `3`    |
| `gap`     | 项之间的间距，一对值分别为行距与列距 | `GridGap \| [GridGap, GridGap]`                            | `'md'` |
| `itemKey` | 每项的唯一键，属性名或函数           | `string \| ((item: T, index: number) => string \| number)` | 下标   |

`GridGap` 为 `'sm' | 'md' | 'lg' | number | string`。`Responsive<T>` 为 `T` 或 `{ base?, sm?, md?, lg?, xl? }`。

### Masonry Slots

| 名称      | 说明                           |
| --------- | ------------------------------ |
| `default` | 一项，参数为 `{ item, index }` |

### Masonry 实例方法

| 名称       | 说明                 | 类型         |
| ---------- | -------------------- | ------------ |
| `relayout` | 重新测量并排布全部项 | `() => void` |

### CSS 变量

| 变量                       | 说明 |
| -------------------------- | ---- |
| `--dou-masonry-row-gap`    | 行距 |
| `--dou-masonry-column-gap` | 列距 |
