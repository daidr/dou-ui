# VirtualList 虚拟列表

数据量很大时，只渲染可视区域附近的条目，滚动依然流畅。

列表本身不画任何外观：没有底色、描边和内边距，外观交给放在里面的内容或外面的容器。

## 基础用法

`items` 是数据，`item-size` 是每一项的高度（px），`height` 是视口高度。默认插槽拿到 `{ item, index }`。

<DocDemo src="virtual-list/basic" column />

高度需要事先知道，这样每一项的位置是算出来的，而不是滚到那里才量出来的，滚动条和跳转都是准的。高度不一的列表传一个函数：`:item-size="(item, index) => (item.group ? 28 : 36)"`。

不传 `height` 时列表撑满父元素，父元素需要有确定的高度。

## 跳转到某一项

`scrollToIndex(index, align)` 把某一项滚进视口。`align` 默认 `'nearest'`，已经可见时不动，否则只滚最少的距离；也可以是 `'start'`、`'center'`、`'end'`。

<DocDemo src="virtual-list/scroll-to" column />

## 滚动加载

滚到距底部 `end-threshold`（默认 40px）以内时触发 `end-reached`，追加数据后列表变长，下一次到底会再次触发。

<DocDemo src="virtual-list/infinite" column />

## 键盘与读屏

列表只是滚动容器，语义由内容决定：做成列表时给容器 `role="list"`、条目 `role="listitem"`，并用 `aria-setsize` / `aria-posinset` 告诉读屏器总数和位置，因为页面里只有一部分条目。需要键盘逐项移动时，参考 [Tree](./tree) 的做法：焦点留在容器上，用 `aria-activedescendant` 指向当前项，移动前先 `scrollToIndex`。

列表本身可以获得焦点（`tabindex="0"`），键盘用户能用方向键和翻页键滚动它。像 Tree 这样自己管理焦点的父组件，传入 `:tabindex="null"` 去掉它。

## API

### Props

| 名称           | 说明                                     | 类型                                                     | 默认值     |
| -------------- | ---------------------------------------- | -------------------------------------------------------- | ---------- |
| `items`        | 数据                                     | `T[]`                                                    | —          |
| `itemSize`     | 每一项的高度（px），或按项返回高度的函数 | `number \| (item: T, index: number) => number`           | —          |
| `itemKey`      | 唯一键所在的属性，或返回唯一键的函数     | `string \| (item: T, index: number) => string \| number` | 下标       |
| `height`       | 视口高度，数字为 px                      | `number \| string`                                       | 撑满父元素 |
| `overscan`     | 视口上下多渲染的条数                     | `number`                                                 | `4`        |
| `endThreshold` | 距底部多少 px 算作到底                   | `number`                                                 | `40`       |

### Events

| 名称          | 说明         | 参数             |
| ------------- | ------------ | ---------------- |
| `scroll`      | 滚动         | `(event: Event)` |
| `end-reached` | 滚到接近底部 | —                |

### Slots

| 名称      | 说明                               |
| --------- | ---------------------------------- |
| `default` | 一项内容，参数为 `{ item, index }` |
| `empty`   | 没有数据时显示                     |

### Exposes

| 名称            | 说明               | 类型                                                                         |
| --------------- | ------------------ | ---------------------------------------------------------------------------- |
| `scrollToIndex` | 把某一项滚进视口   | `(index: number, align?: 'start' \| 'center' \| 'end' \| 'nearest') => void` |
| `scrollTo`      | 滚到某个偏移（px） | `(offset: number) => void`                                                   |
| `el`            | 滚动容器元素       | `() => HTMLElement \| null`                                                  |
