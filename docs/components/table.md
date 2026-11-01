# Table 表格

展示多条结构相同的数据，支持排序、筛选、多选、展开行、树形数据和虚拟滚动等功能。

## 基础用法

<DocDemo src="table/basic" column />

每一列的 `key` 既是列的标识，也是从行里取值的属性名；需要计算时用 `value: (row) => …`。数字列用 `align: 'end'`，配合等宽数字，位数能对齐。

## 自定义单元格

`cell-<key>` 插槽替换某一列的单元格，参数为 `{ row, column, value, index }`；`cell` 插槽替换所有单元格。表头同理，用 `header-<key>` 与 `header`。

<DocDemo src="table/custom-cell" column />

## 行内编辑

在 `cell-<key>` 插槽里按行切换显示内容和输入控件。下面的示例把编辑中的值放在单独的草稿对象里，用 `DouForm` 包住表格做校验：点“保存”或在输入框中按 `Enter` 提交表单，校验通过后才写回行数据，点“取消”直接丢弃草稿。

<DocDemo src="table/editable" column />

## 排序

列上的 `sortable` 让表头可以点击排序：升序 → 降序 → 不排序。`true` 按单元格的值比较：数字按大小，文字按页面语言并把其中的数字按数值排（`node-2` 在 `node-10` 前面）；也可以传一个比较两行的函数。当前的排序用 `v-model:sort` 绑定。

<DocDemo src="table/sort" column />

数据在服务端排序时加上 `manual-sort`：表格不再改动 `data` 的顺序，只更新 `sort`。

## 选择

`selectable` 在最前面加一列多选框，选中行的 key（由 `row-key` 决定，默认取 `id`）绑定在 `v-model:selected`。传一个函数可以决定哪些行能被选择。表头的框选择全部可选行，部分选中时显示为横线。

<DocDemo src="table/selection" column />

## 密度、边框与斑马纹

`size` 调整行高：`sm` 36px、`md` 44px、`lg` 52px。`bordered` 在列之间也画细线，`striped` 隔行加底色。

<DocDemo src="table/density" column />

## 固定表头、加载与空状态

`max-height` 限制高度，超出后表体滚动、表头固定。`loading` 把行压暗并在上面显示加载动画。没有数据时显示紧凑的 [空状态](./empty)，文字用 `empty-text` 或 `empty` 插槽替换。

<DocDemo src="table/fixed-header" column />

## 配合分页

表格本身不分页，把当前页的数据交给它，再在下面放一个 [分页](./pagination)：

<DocDemo src="table/pagination" column />

## 固定列

列很多、需要横向滚动时，给关键列加 `fixed: 'start'` 或 `fixed: 'end'`，它们会停在两侧不动。固定列需要数字 `width`，用来算出停靠的位置；内容滑到固定列下面时，交界处出现一道淡淡的阴影。选择列与展开列会跟着靠前的固定列一起停住。

<DocDemo src="table/fixed-column" column />

## 展开行

`expandable` 加一列展开按钮，展开后在这一行下面用 `expand` 插槽显示详情；传函数决定哪些行可以展开。展开的行用 `v-model:expanded` 绑定。

<DocDemo src="table/expand" column />

## 树形数据

行里有 `children` 数组时，表格变成一棵树：第一列出现展开按钮，子行逐级缩进。展开的行同样用 `v-model:expanded` 绑定；排序在每一层的兄弟行之间进行。子行属性名可用 `children-key` 修改，缩进用 `indent`。

<DocDemo src="table/tree" column />

## 调整列宽

`resizable` 让所有列都能拖动表头右边缘调整宽度，也可以只给某一列设 `resizable`。手柄能用 `Tab` 聚焦，`←` `→` 每次调整 8px，按住 `Shift` 为 32px。调整后触发 `columnResize`，可以把宽度存下来。

<DocDemo src="table/resize" column />

## 合计行

`summary` 接收所有行，返回按列 `key` 排好的值，显示在表格底部；有 `max-height` 时合计行固定在底部。

<DocDemo src="table/summary" column />

## 虚拟滚动

上千行时打开 `virtual`，只渲染看得见的那些行，需要 `max-height`。行高按渲染后的实际高度计算，所以单元格可以换行，也可以有展开行。下面是一万行。

<DocDemo src="table/virtual" column />

传入 `row-height` 时，每一行都是这个高度，内容只显示一行，超出部分省略，也不显示展开行。行高固定时滚动条始终准确，适合数据密集、每行内容长度相近的表格。

## 多级表头

列的 `children` 把几列归到一个表头下，可以嵌套多层。分组只有表头：它的 `key`、`title`、`align` 和 `fixed` 生效，其余由下面的列决定；分组设了 `fixed` 时，下面的列一起固定。有分组时表头每一格都画上竖线，一眼能看出哪些列属于同一组；`max-height` 下每一层表头都会固定。

<DocDemo src="table/grouped-header" column />

## 合并单元格

`span-method` 对每个单元格调用一次，参数是 `{ row, column, rowIndex, columnIndex }`，返回它占几行几列：`[rowspan, colspan]` 或 `{ rowspan, colspan }`；被别的格子盖住的格子返回 `[0, 0]`，不返回则为一格。`columnIndex` 只数显示数据的列，不含分组、多选和展开列。合并单元格用于静态的报表，不支持虚拟滚动，也不建议和展开行一起用。

<DocDemo src="table/span" column />

## 筛选

给列加上 `filters`，表头会出现一个漏斗按钮，点开是一组选项。默认可以多选，勾好后按“筛选”生效；`filter-multiple` 为 `false` 时只能选一项，点一下立即生效。选中的值按列 `key` 放在 `v-model:filters` 里，漏斗变成墨色表示这一列正在筛选。

一行要在每个正在筛选的列上都通过才显示；在一列上，通过任意一个选中的值即可。默认比较单元格的值，`filter-method(value, row)` 可以自己判断。树形数据里，子行通过时它的上级也会保留。

<DocDemo src="table/filter" column />

在服务器上筛选时加 `manual-filter`，表格不再自己过滤 `data`，只报告 `filters`。

## 当前行与行事件

`highlight-current` 让点击的行成为当前行，绑定在 `v-model:current` 上；当前行用选中行的底色，起始边多一道深色竖线，适合主从表这类“选中一行看详情”的场景。`row-class`、`row-style` 给行加类名和样式，可以是值，也可以是 `(row, index) => …` 函数。

除了 `rowClick`，还有 `rowDblclick`、`rowContextmenu`（配合 ContextMenu 做右键菜单）和 `cellClick`（多了列）。

<DocDemo src="table/current-row" column />

## 树形懒加载

子行要从接口取时，在行上标 `hasChildren: true`，并给表格一个 `load(row)`，返回子行的 Promise。第一次展开时调用，期间按钮变成加载圈；取回的子行会缓存，之后再展开不再调用。失败时触发 `loadError`，行保持收起，可以再点一次重试。属性名可用 `has-children-key` 修改。

<DocDemo src="table/tree-lazy" column />

## 拖拽排序

`draggable` 在最前面加一列拖动手柄，按住手柄把行拖到新位置。松开后新的顺序通过 `update:data` 传出，所以 `data` 要用 `v-model:data` 绑定；同时触发 `rowDrop`，参数为 `{ row, oldIndex, newIndex }`。

<DocDemo src="table/draggable" column />

拖拽改的是 `data` 本身的顺序，所以在按列排序或筛选生效时暂停（手柄变灰），树形表格和虚拟滚动也不支持。键盘上聚焦手柄后按空格键拿起，用 `↑` `↓` 移动，再按空格键放下，`Esc` 取消，与 [Sortable](./sortable) 一致。

## 列的显示与顺序

`v-model:column-keys` 是要显示的顶层列的 `key`，按数组顺序排列；不传时显示 `columns` 中的全部列。分组表头作为一个整体显示或隐藏。

表格不内置列设置面板，用 Popover、Checkbox 和 Sortable 就能拼出一个，下面的例子可以勾选和拖动列：

<DocDemo src="table/column-settings" column />

## 实例方法

`v-model` 已经能控制选中、展开、排序和筛选，实例方法是给“按一下按钮做某事”准备的快捷方式：`toggleRowSelection(key, selected?)`、`clearSelection()`、`toggleRowExpansion(key, expanded?)`、`clearSort()`、`clearFilters(key?)`、`setCurrent(key)`，以及 `scrollToRow(key)`（先展开它的上级再滚过去，虚拟滚动也可以）和 `scrollTo(top)`。

<DocDemo src="table/methods" column />

选中是按 `key` 记录的：翻页后不在当前 `data` 里的已选行仍然保留在 `v-model:selected` 中，“全选”也只影响当前能看到的行。

## 读屏

表头单元格带 `scope="col"`；可排序的列在 `<th>` 上用 `aria-sort` 标明当前方向，排序的开关是表头里的按钮。选择框各自有读屏名称（“选择全部”“选择此行”，来自语言包）。加载中时表格带 `aria-busy`。

展开按钮带 `aria-expanded`，详情行的按钮还用 `aria-controls` 指向详情行。列宽手柄是可聚焦的 `role="separator"`，用 `aria-valuenow` 报告当前宽度。虚拟滚动时表格带 `aria-rowcount`，每一行带 `aria-rowindex`，读屏仍能知道总行数与当前位置。

## API

### Props

| 名称                    | 说明                                                   | 类型                                                                                                  | 默认值          |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------- |
| `data`                  | 行                                                     | `T[]`                                                                                                 | —               |
| `columns`               | 列                                                     | `TableColumn<T>[]`                                                                                    | —               |
| `columnKeys`（v-model） | 显示的顶层列及其顺序                                   | `string[]`                                                                                            | 全部列          |
| `rowKey`                | 行的唯一键：属性名或函数                               | `string \| ((row: T) => key)`                                                                         | `'id'`          |
| `size`                  | 行高密度                                               | `'sm' \| 'md' \| 'lg'`                                                                                | `'md'`          |
| `bordered`              | 列之间也画细线                                         | `boolean`                                                                                             | `false`         |
| `striped`               | 隔行加底色                                             | `boolean`                                                                                             | `false`         |
| `hoverable`             | 悬停的行加深                                           | `boolean`                                                                                             | `true`          |
| `maxHeight`             | 最大高度，超出后滚动、表头固定；数字为像素             | `number \| string`                                                                                    | —               |
| `loading`               | 加载中                                                 | `boolean`                                                                                             | `false`         |
| `emptyText`             | 空状态文字，默认取语言包的“暂无数据”                   | `string`                                                                                              | —               |
| `selectable`            | 加一列多选框；函数决定哪些行可选                       | `boolean \| ((row: T) => boolean)`                                                                    | `false`         |
| `selected`              | 选中行的 key，`v-model:selected`                       | `(string \| number)[]`                                                                                | `[]`            |
| `sort`                  | 排序，`v-model:sort`                                   | `{ key: string; order: 'asc' \| 'desc' } \| null`                                                     | `null`          |
| `manualSort`            | 不改动 `data` 的顺序，只报告 `sort`                    | `boolean`                                                                                             | `false`         |
| `expandable`            | 加一列展开按钮；函数决定哪些行可展开                   | `boolean \| ((row: T) => boolean)`                                                                    | `false`         |
| `expanded`              | 展开的行（详情与树形），`v-model:expanded`             | `(string \| number)[]`                                                                                | `[]`            |
| `childrenKey`           | 子行所在的属性                                         | `string`                                                                                              | `'children'`    |
| `indent`                | 树形每一层的缩进，像素                                 | `number`                                                                                              | `16`            |
| `resizable`             | 所有列都可拖动调整宽度                                 | `boolean`                                                                                             | `false`         |
| `summary`               | 合计行的值，按列 `key`                                 | `(rows: T[]) => Record<string, unknown>`                                                              | —               |
| `virtual`               | 只渲染看得见的行，需要 `maxHeight`                     | `boolean`                                                                                             | `false`         |
| `rowHeight`             | 虚拟滚动时每一行固定的高度，像素；不传时按实际高度计算 | `number`                                                                                              | —               |
| `spanMethod`            | 合并单元格，返回占几行几列                             | `(ctx: { row, column, rowIndex, columnIndex }) => [number, number] \| { rowspan?, colspan? } \| void` | —               |
| `filters`               | 各列选中的筛选值，`v-model:filters`                    | `Record<string, unknown[]>`                                                                           | `{}`            |
| `manualFilter`          | 不过滤 `data`，只报告 `filters`                        | `boolean`                                                                                             | `false`         |
| `highlightCurrent`      | 点击的行成为当前行                                     | `boolean`                                                                                             | `false`         |
| `current`               | 当前行的 key，`v-model:current`                        | `string \| number \| null`                                                                            | `null`          |
| `rowClass`              | 行的类名                                               | `string \| ((row: T, index: number) => string)`                                                       | —               |
| `rowStyle`              | 行的样式                                               | `CSSProperties \| ((row: T, index: number) => CSSProperties)`                                         | —               |
| `load`                  | 树形懒加载：第一次展开时取子行                         | `(row: T) => Promise<T[]>`                                                                            | —               |
| `draggable`             | 加一列拖动手柄，拖拽排序，配合 `v-model:data`          | `boolean`                                                                                             | `false`         |
| `hasChildrenKey`        | 标记“有子行待加载”的属性                               | `string`                                                                                              | `'hasChildren'` |

### TableColumn

| 名称             | 说明                                         | 类型                                  |
| ---------------- | -------------------------------------------- | ------------------------------------- |
| `key`            | 列的标识，也是取值的属性名                   | `string`                              |
| `title`          | 表头文字                                     | `string`                              |
| `value`          | 从行里取值                                   | `(row: T) => unknown`                 |
| `width`          | 宽度；数字为像素                             | `number \| string`                    |
| `minWidth`       | 最小宽度                                     | `number \| string`                    |
| `align`          | 对齐                                         | `'start' \| 'center' \| 'end'`        |
| `sortable`       | 可排序；函数比较两行                         | `boolean \| ((a: T, b: T) => number)` |
| `ellipsis`       | 单行显示，超出部分省略                       | `boolean`                             |
| `fixed`          | 横向滚动时停在一侧，需要数字 `width`         | `'start' \| 'end'`                    |
| `resizable`      | 可拖动调整宽度，优先于表格的 `resizable`     | `boolean`                             |
| `children`       | 归在这个表头下的列，用于多级表头             | `TableColumn<T>[]`                    |
| `filters`        | 筛选选项                                     | `{ label: string; value: unknown }[]` |
| `filterMultiple` | 筛选可多选                                   | `boolean`，默认 `true`                |
| `filterMethod`   | 一行是否通过某个选中的值，默认比较单元格的值 | `(value: unknown, row: T) => boolean` |

### Events

| 名称              | 说明                   | 参数                                                      |
| ----------------- | ---------------------- | --------------------------------------------------------- |
| `update:selected` | 选中行变化             | `(keys: (string \| number)[])`                            |
| `update:sort`     | 排序变化               | `(sort: TableSort \| null)`                               |
| `rowClick`        | 点击了某一行           | `(row: T, index: number, event: MouseEvent)`              |
| `update:expanded` | 展开的行变化           | `(keys: (string \| number)[])`                            |
| `columnResize`    | 调整了列宽             | `(key: string, width: number)`                            |
| `update:filters`  | 筛选变化               | `(filters: Record<string, unknown[]>)`                    |
| `update:current`  | 当前行变化             | `(key: string \| number \| null)`                         |
| `rowDblclick`     | 双击了某一行           | `(row: T, index: number, event: MouseEvent)`              |
| `rowContextmenu`  | 在某一行上打开右键菜单 | `(row: T, index: number, event: MouseEvent)`              |
| `cellClick`       | 点击了某个单元格       | `(row: T, column: TableColumn<T>, event: MouseEvent)`     |
| `loadError`       | `load` 失败            | `(row: T, error: unknown)`                                |
| `update:data`     | 拖拽后的新顺序         | `(data: T[])`                                             |
| `rowDrop`         | 行被拖到新位置         | `(event: { row: T, oldIndex: number, newIndex: number })` |

### Slots

| 名称           | 说明                                                   |
| -------------- | ------------------------------------------------------ |
| `cell-<key>`   | 某一列的单元格，参数为 `{ row, column, value, index }` |
| `cell`         | 所有单元格                                             |
| `header-<key>` | 某一列的表头，参数为 `{ column }`                      |
| `header`       | 所有表头                                               |
| `empty`        | 替换空状态                                             |
| `expand`       | 展开行的详情，参数为 `{ row, index }`                  |

### Exposes

| 名称                 | 说明                                 | 类型                                                  |
| -------------------- | ------------------------------------ | ----------------------------------------------------- |
| `scrollToRow`        | 展开上级并滚到某一行                 | `(key: string \| number) => void`                     |
| `scrollTo`           | 滚到某个位置，像素                   | `(top: number) => void`                               |
| `toggleRowSelection` | 选中或取消一行，不传第二个参数则切换 | `(key: string \| number, selected?: boolean) => void` |
| `clearSelection`     | 清除选中                             | `() => void`                                          |
| `toggleRowExpansion` | 展开或收起一行                       | `(key: string \| number, expanded?: boolean) => void` |
| `clearSort`          | 清除排序                             | `() => void`                                          |
| `clearFilters`       | 清除某一列或全部筛选                 | `(key?: string) => void`                              |
| `setCurrent`         | 设置当前行                           | `(key: string \| number \| null) => void`             |

### CSS 变量

| 变量                         | 说明                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `--dou-table-cell-height`    | 行高                                                      |
| `--dou-table-cell-padding-x` | 单元格水平内边距                                          |
| `--dou-table-head-bg`        | 表头底色                                                  |
| `--dou-table-row-bg`         | 行底色，可以在 `row-style` 里给单独一行设置，固定列跟着变 |
| `--dou-table-row-hover`      | 悬停行底色                                                |
| `--dou-table-row-selected`   | 选中行底色                                                |
| `--dou-table-fixed-shadow`   | 固定列交界处的阴影颜色                                    |
