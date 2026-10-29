# Sortable 拖拽排序

拖动列表项调整顺序，也可以在几个列表之间移动，用于任务排序、看板、自定义列顺序等场景。

## 基础用法

`v-model` 绑定数组，默认插槽渲染每一项，插槽参数有 `item`、`index`。拖动时其他项会滑动让位，松开后才写回新的数组；按 `Esc` 可以取消。每一项需要一个唯一的键，默认取 `id`，字符串和数字取它本身，也可以用 `item-key` 指定。

<DocDemo src="sortable/basic" />

## 拖拽手柄

`handle` 时只能从 `DouSortableHandle` 开始拖动，项里的其他内容可以正常点击和选中。

<DocDemo src="sortable/handle" />

## 网格

项横向排列时设置 `direction`：`horizontal` 用左右方向键移动，`grid` 上下左右都可以。列表默认是纵向的 flex 布局，横排和网格用 flex 换行，也可以用 `class` 或 `style` 换成自己的布局。

<DocDemo src="sortable/grid" />

## 列表之间移动

`group` 相同的列表之间可以互相拖动。移出的列表触发 `remove`，移入的列表触发 `add`，两边的 `v-model` 都会更新。`empty` 插槽在列表为空时显示，可以作为放置区域。

<DocDemo src="sortable/group" />

## 键盘与读屏

| 按键              | 作用                       |
| ----------------- | -------------------------- |
| `Space` / `Enter` | 拿起聚焦的项，再按一次放下 |
| 方向键            | 移动拿起的项               |
| `Home` / `End`    | 移到最前 / 最后            |
| `Esc`             | 取消移动，放回原处         |

拿起、移动、放下和取消都会通过一个 `aria-live` 区域读出位置，比如“已拿起整理设计稿，当前位置 1，共 4 项”。项的名称默认是“第 n 项”，用 `item-label` 换成更有意义的名字。键盘只在同一个列表内移动。

触屏上直接按住整项会先判断是否在滚动页面，按住约 250 毫秒后才开始拖动；手柄可以立即拖动。拖到滚动容器或窗口的边缘时会自动滚动。

## 组合式函数

`useSortable` 提供同样的拖动与键盘逻辑，适合不方便用组件包裹的结构，比如表格的 `tbody`。把 `listAttrs` 绑在容器上、`itemAttrs(item, index)` 绑在每一项上，渲染时用它返回的 `list`。

```ts
const { container, list, listAttrs, itemAttrs } = useSortable({
  items: rows, // Ref<Row[]>，放下时被替换
  key: (row) => row.id,
  messages: () => ({ item: '可排序行', lifted, moved, dropped, canceled }),
})
```

## API

### Sortable Props

| 名称         | 说明                             | 类型                                   | 默认值       |
| ------------ | -------------------------------- | -------------------------------------- | ------------ |
| `modelValue` | 列表，配合 `v-model`，放下时替换 | `T[]`                                  | —            |
| `itemKey`    | 唯一键的字段名，或返回键的函数   | `string \| (item: T) => PropertyKey`   | `'id'`       |
| `direction`  | 排列方向，决定方向键             | `'vertical' \| 'horizontal' \| 'grid'` | `'vertical'` |
| `group`      | 同组的列表之间可以互相拖动       | `string`                               | —            |
| `handle`     | 只能从 `DouSortableHandle` 拖动  | `boolean`                              | `false`      |
| `disabled`   | 禁止拖动                         | `boolean`                              | `false`      |
| `animation`  | 拖动时其他项滑动让位             | `boolean`                              | `true`       |
| `tag`        | 列表元素                         | `string`                               | `'div'`      |
| `itemTag`    | 每一项的元素                     | `string`                               | `'div'`      |
| `itemLabel`  | 读屏时项的名称                   | `(item: T, index: number) => string`   | “第 n 项”    |

### Sortable Events

| 名称                | 说明                 | 参数                             |
| ------------------- | -------------------- | -------------------------------- |
| `update:modelValue` | 放下后的新列表       | `(value: T[])`                   |
| `sort`              | 在本列表内换了位置   | `({ item, oldIndex, newIndex })` |
| `add`               | 从同组的其他列表移入 | `({ item, oldIndex, newIndex })` |
| `remove`            | 移到了同组的其他列表 | `({ item, oldIndex, newIndex })` |

### Sortable Slots

| 名称      | 说明                                     |
| --------- | ---------------------------------------- |
| `default` | 每一项，参数 `{ item, index, dragging }` |
| `empty`   | 列表为空时显示                           |

### SortableHandle Props

| 名称    | 说明           | 类型     | 默认值     |
| ------- | -------------- | -------- | ---------- |
| `label` | 手柄的读屏名称 | `string` | “拖动排序” |
