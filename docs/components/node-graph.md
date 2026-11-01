# NodeGraph 节点图

按依赖关系从左到右（或从上到下）展示一组节点和它们之间的连线。

NodeGraph 只用来展示。需要拖动节点、连线编辑时，用[流程编辑器](/flow/)。

## 基础用法

`nodes` 是节点，`edges` 是连线，`from` 指向 `to`。节点按依赖深度分层，跨层的连线从节点之间的空隙穿过。

<DocDemo src="node-graph/basic" />

连线必须构成有向无环图。成环的那条连线会被忽略。

## 状态与类型

`status` 有五种：`wait` 未开始、`process` 进行中、`finish` 已完成、`error` 出错、`blocked` 依赖项未完成。未开始的节点标题会变淡。

`kind: 'milestone'` 把状态点换成旗帜，表示里程碑。`incomplete` 在节点右端加一个标记，表示还有未完成的子任务。

`auto-blocked` 让组件自己推断：进行中的节点只要有前驱没完成，就显示为 `blocked`。

<DocDemo src="node-graph/status" />

## 节点内容

`icon` 放在标题前，`extra` 放在标题后，适合耗时、大小这类短数值。`progress`（0–100）在节点底部显示一条进度，有进度的节点会变成卡片。标题放不下时会截断，`extra` 最多占一半宽度。

<DocDemo src="node-graph/content" />

默认 `node-width="column"`，同一层的节点等宽；`auto` 让每个节点按内容决定宽度；传数字则所有节点固定宽度。

## 方向

`direction="vertical"` 让连线从上往下走，节点按层一行一行排开，连线从节点底部出发、进入下一层节点的顶部。每个节点都对齐到等宽的竖向轨道上，分叉和汇合依然左右对称。

<DocDemo src="node-graph/direction" />

`column-gap` 和 `row-gap` 始终指屏幕上的左右间距和上下间距：从左到右时 `column-gap` 是层与层之间的距离，从上到下时 `row-gap` 才是。

## 卡片

有 `description` 或 `progress` 的节点会变成卡片，说明文字在标题下面。卡片比单行节点高，连线对齐标题行。`descriptionTone` 给说明加上浅色底，用来提醒。`shape` 可以强制指定 `pill` 或 `card`。

<DocDemo src="node-graph/card" />

## 选中与悬停

点击节点选中它，配合 `v-model:selected`。`selectable="multiple"` 可以多选，`false` 关闭选择。

悬停节点时，它的上下游链路保持原样，其余部分变淡。`highlight="selected"` 改为高亮选中节点的链路，`none` 关闭高亮。

`detail` 插槽的内容会在悬停时以弹出层显示。也可以监听 `nodeEnter` 和 `nodeLeave`，参数里有节点数据和节点元素，用来自己控制弹出层。

<DocDemo src="node-graph/selection" column />

## 插槽

节点的每个部分都有插槽：`status` 状态点、`icon` 图标、`label` 标题、`extra` 附加信息、`description` 第二行、`corner` 右上角。`node` 插槽接管节点的全部内容，外框、位置和选中状态仍由组件处理。插槽参数是 `{ node, status, selected, hovered }`。

下面用 `corner` 在右上角放一个提醒按钮，点击切换是否在节点完成时提醒。点击它不会选中节点。

<DocDemo src="node-graph/corner" />

## 平移与缩放

图比容器大时，可以拖动、滚动或在触控板上滑动来平移，`pannable` 默认开启。普通滚轮纵向移动，按住 Shift 横向移动；移到边缘后页面会继续滚动。

`zoomable` 开启缩放：按住 Ctrl 或 ⌘ 滚动滚轮，或在触控板上捏合，右上角也会出现缩放按钮。缩放比例可以用 `v-model:zoom` 绑定。`height` 固定容器高度，默认和图一样高。`legend` 在工具栏加一个图例按钮。

<DocDemo src="node-graph/zoom" column />

图例也可以单独使用：`<DouNodeGraphLegend :nodes="nodes" />` 只列出这些节点用到的类型和状态，不传 `nodes` 则列出全部。

<DocDemo src="node-graph/legend" />

## 综合示例

一个 App 发版流程，用上了上面的所有特性：图标、附加信息、进度、卡片说明、未完成标记、里程碑、`auto-blocked`、多选、悬停详情、`corner` 评论数、工具栏里的“关键路径”开关（切换连线的 `active` 和 `muted`），以及缩放和图例。“复盘”节点设为 `disabled`，不能选中。

<DocDemo src="node-graph/complex" column />

## 键盘与读屏

每个节点都是一个按钮，可选择时带 `aria-pressed`。节点的读屏文字包含名称、类型、状态、进度和它依赖的节点，比如“确认议程，进行中，依赖 预订场地，邀请嘉宾”，不靠颜色传达状态。

整张图只占一个 Tab 位置。进入后用 ← → 移到前驱或后继，↑ ↓ 在同一层内移动，Enter 或空格选中；从上到下时换过来，↑ ↓ 移到前驱或后继，← → 在同一层内移动。焦点移到视野外的节点时，图会自动平移过去。

## API

### Props

| 名称             | 说明                                                     | 类型                              | 默认值         |
| ---------------- | -------------------------------------------------------- | --------------------------------- | -------------- |
| `nodes`          | 节点                                                     | `GraphNode[]`                     | —              |
| `edges`          | 连线                                                     | `GraphEdge[]`                     | —              |
| `selected`       | 选中的节点，`v-model:selected`                           | `string \| string[] \| null`      | `null`         |
| `selectable`     | 是否可选，`multiple` 为多选                              | `boolean \| 'multiple'`           | `true`         |
| `size`           | 尺寸，单行节点高 28 / 32 / 40                            | `'sm' \| 'md' \| 'lg'`            | 跟随全局       |
| `direction`      | 连线方向：`horizontal` 从左到右，`vertical` 从上到下     | `'horizontal' \| 'vertical'`      | `'horizontal'` |
| `node-width`     | 节点宽度：同层等宽、按内容、固定值                       | `'column' \| 'auto' \| number`    | `'column'`     |
| `max-node-width` | 节点最大宽度，超出时截断标题                             | `number`                          | `320`          |
| `column-gap`     | 左右间距：从左到右时是层间距，从上到下时是同层节点的间距 | `number`                          | 按尺寸和方向   |
| `row-gap`        | 上下间距：从左到右时是同层节点的间距，从上到下时是层间距 | `number`                          | 按尺寸和方向   |
| `highlight`      | 高亮哪个节点的上下游链路                                 | `'none' \| 'hover' \| 'selected'` | `'hover'`      |
| `auto-blocked`   | 自动把前驱未完成的进行中节点显示为 `blocked`             | `boolean`                         | `false`        |
| `pannable`       | 是否可以平移                                             | `boolean`                         | `true`         |
| `zoomable`       | 是否可以缩放                                             | `boolean`                         | `false`        |
| `zoom`           | 缩放比例，`v-model:zoom`                                 | `number`                          | `1`            |
| `min-zoom`       | 最小缩放比例                                             | `number`                          | `0.25`         |
| `max-zoom`       | 最大缩放比例                                             | `number`                          | `2`            |
| `legend`         | 在工具栏显示图例按钮                                     | `boolean`                         | `false`        |
| `height`         | 容器高度，数字单位为 px                                  | `string \| number`                | 和图一样高     |
| `aria-label`     | 读屏用的名称                                             | `string`                          | `'节点图'`     |

### GraphNode

| 字段              | 说明                       | 类型                                                           |
| ----------------- | -------------------------- | -------------------------------------------------------------- |
| `id`              | 唯一标识                   | `string`                                                       |
| `label`           | 标题                       | `string`                                                       |
| `kind`            | 类型                       | `'task' \| 'milestone'`                                        |
| `status`          | 状态，默认 `wait`          | `'wait' \| 'process' \| 'finish' \| 'error' \| 'blocked'`      |
| `icon`            | 标题前的图标               | `Component`                                                    |
| `extra`           | 标题后的附加信息           | `string \| number`                                             |
| `description`     | 第二行说明，节点会变成卡片 | `string`                                                       |
| `descriptionTone` | 说明的语义色               | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` |
| `shape`           | 强制单行或卡片             | `'pill' \| 'card'`                                             |
| `progress`        | 进度，0–100                | `number`                                                       |
| `incomplete`      | 含未完成子任务             | `boolean`                                                      |
| `disabled`        | 不可选中                   | `boolean`                                                      |

其他字段会原样传给插槽。

### GraphEdge

| 字段     | 说明                                  | 类型                               |
| -------- | ------------------------------------- | ---------------------------------- |
| `from`   | 起点节点的 `id`                       | `string`                           |
| `to`     | 终点节点的 `id`                       | `string`                           |
| `status` | `active` 加深连线，`muted` 显示为虚线 | `'default' \| 'active' \| 'muted'` |

### Events

| 名称             | 说明                                   | 参数                                   |
| ---------------- | -------------------------------------- | -------------------------------------- |
| `nodeClick`      | 点击节点                               | `(node: GraphNode, event: MouseEvent)` |
| `nodeDblclick`   | 双击节点                               | `(node: GraphNode, event: MouseEvent)` |
| `nodeEnter`      | 指针移入节点                           | `(node: GraphNode, el: HTMLElement)`   |
| `nodeLeave`      | 指针移出节点                           | `(node: GraphNode, el: HTMLElement)`   |
| `update:hovered` | 悬停的节点变化，可用 `v-model:hovered` | `(id: string \| null)`                 |

### Slots

| 名称          | 说明               | 参数                 |
| ------------- | ------------------ | -------------------- |
| `node`        | 节点的全部内容     | `GraphNodeSlotProps` |
| `status`      | 状态点             | `GraphNodeSlotProps` |
| `icon`        | 图标               | `GraphNodeSlotProps` |
| `label`       | 标题               | `GraphNodeSlotProps` |
| `extra`       | 附加信息           | `GraphNodeSlotProps` |
| `description` | 卡片的第二行       | `GraphNodeSlotProps` |
| `corner`      | 右上角             | `GraphNodeSlotProps` |
| `detail`      | 悬停时弹出的内容   | `GraphNodeSlotProps` |
| `toolbar`     | 工具栏里的其他按钮 | —                    |
| `legend`      | 图例弹出层的内容   | —                    |
| `empty`       | 没有节点时显示     | —                    |

### Methods

| 名称           | 说明                                       | 类型                     |
| -------------- | ------------------------------------------ | ------------------------ |
| `scrollToNode` | 平移到节点                                 | `(id: string) => void`   |
| `fit`          | 显示整张图：可缩放时缩小到放得下，否则居中 | `() => void`             |
| `zoomTo`       | 缩放到指定比例                             | `(zoom: number) => void` |
| `resetView`    | 回到 100% 和起点                           | `() => void`             |
| `relayout`     | 重新测量节点并布局，比如字体加载之后       | `() => void`             |

### NodeGraphLegend Props

| 名称    | 说明                           | 类型                    | 默认值   |
| ------- | ------------------------------ | ----------------------- | -------- |
| `nodes` | 只列出这些节点用到的类型和状态 | `GraphNode[]`           | 列出全部 |
| `items` | 自定义图例项                   | `NodeGraphLegendItem[]` | —        |
| `title` | 标题                           | `string`                | `'图例'` |
